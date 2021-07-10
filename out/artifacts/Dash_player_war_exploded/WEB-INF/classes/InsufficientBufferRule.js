import EventBus from '../../../core/EventBus';
import Events from '../../../core/events/Events';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';
import SwitchRequest from '../SwitchRequest';
import Constants from '../../constants/Constants';
import MetricsConstants from '../../constants/MetricsConstants';

function InsufficientBufferRule(config) {

    config = config || {};
    const INSUFFICIENT_BUFFER_SAFETY_FACTOR = 0.5;
    const SEGMENT_IGNORE_COUNT = 2;

    const context = this.context;

    const eventBus = EventBus(context).getInstance();
    const dashMetrics = config.dashMetrics;

    let instance,
        logger,
        bufferStateDict;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        resetInitialSettings();
        eventBus.on(Events.PLAYBACK_SEEKING, onPlaybackSeeking, instance);
        eventBus.on(Events.BYTES_APPENDED_END_FRAGMENT, onEndFragment, instance);
    }

    function checkConfig() {
        if (!dashMetrics || !dashMetrics.hasOwnProperty('getCurrentBufferLevel') || !dashMetrics.hasOwnProperty('getCurrentBufferState')) {
            throw new Error(Constants.MISSING_CONFIG_ERROR);
        }
    }

    /*
     * InsufficientBufferRule does not kick in before the first BUFFER_LOADED event happens. This is reset at every seek.
     *
     * If a BUFFER_EMPTY event happens, then InsufficientBufferRule returns switchRequest.quality=0 until BUFFER_LOADED happens.
     *
     * Otherwise InsufficientBufferRule gives a maximum bitrate depending on throughput and bufferLevel such that
     * a whole fragment can be downloaded before the buffer runs out, subject to a conservative safety factor of 0.5.
     * If the bufferLevel is low, then InsufficientBufferRule avoids rebuffering risk.
     * If the bufferLevel is high, then InsufficientBufferRule give a high MaxIndex allowing other rules to take over.
     */
    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaType')) {
            return switchRequest;
        }

        checkConfig();

        const mediaType = rulesContext.getMediaType();
        const currentBufferState = dashMetrics.getCurrentBufferState(mediaType);
        const representationInfo = rulesContext.getRepresentationInfo();
        const fragmentDuration = representationInfo.fragmentDuration;

        // Don't ask for a bitrate change if there is not info about buffer state or if fragmentDuration is not defined
        if (shouldIgnore(mediaType) || !fragmentDuration) {
            return switchRequest;
        }

        if (currentBufferState && currentBufferState.state === MetricsConstants.BUFFER_EMPTY) {
            logger.debug('[' + mediaType + '] Switch to index 0; buffer is empty.');
            switchRequest.quality = 0;
            switchRequest.reason = 'InsufficientBufferRule: Buffer is empty';
        } else {
            const mediaInfo = rulesContext.getMediaInfo();
            const abrController = rulesContext.getAbrController();
            const throughputHistory = abrController.getThroughputHistory();

            const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
            const throughput = throughputHistory.getAverageThroughput(mediaType);
            const latency = throughputHistory.getAverageLatency(mediaType);
            const bitrate = throughput * (bufferLevel / fragmentDuration) * INSUFFICIENT_BUFFER_SAFETY_FACTOR;

            switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, bitrate, latency);
            switchRequest.reason = 'InsufficientBufferRule: being conservative to avoid immediate rebuffering';
        }

        return switchRequest;
    }

    function shouldIgnore(mediaType) {
        return bufferStateDict[mediaType].ignoreCount > 0;
    }

    function resetInitialSettings() {
        bufferStateDict = {};
        bufferStateDict[Constants.VIDEO] = {ignoreCount: SEGMENT_IGNORE_COUNT};
        bufferStateDict[Constants.AUDIO] = {ignoreCount: SEGMENT_IGNORE_COUNT};
    }

    function onPlaybackSeeking() {
        resetInitialSettings();
    }

    function onEndFragment(e) {
        if (!isNaN(e.startTime) && (e.mediaType === Constants.AUDIO || e.mediaType === Constants.VIDEO)) {
            if (bufferStateDict[e.mediaType].ignoreCount > 0) {
                bufferStateDict[e.mediaType].ignoreCount--;
            }
        }
    }

    function reset() {
        resetInitialSettings();
        eventBus.off(Events.PLAYBACK_SEEKING, onPlaybackSeeking, instance);
        eventBus.off(Events.BYTES_APPENDED_END_FRAGMENT, onEndFragment, instance);
    }

    instance = {
        getMaxIndex: getMaxIndex,
        reset: reset
    };

    setup();

    return instance;
}

InsufficientBufferRule.__dashjs_factory_name = 'InsufficientBufferRule';
export default FactoryMaker.getClassFactory(InsufficientBufferRule);
