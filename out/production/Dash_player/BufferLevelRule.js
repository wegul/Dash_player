//From Scheduling
import Constants from '../../constants/Constants';
import FactoryMaker from '../../../core/FactoryMaker';
import MetricsConstants from '../../constants/MetricsConstants';

function BufferLevelRule(config) {

    config = config || {};
    const dashMetrics = config.dashMetrics;
    const mediaPlayerModel = config.mediaPlayerModel;
    const textController = config.textController;
    const abrController = config.abrController;
    const settings = config.settings;

    function setup() {
    }

    function execute(type, representationInfo, hasVideoTrack) {
        if (!type || !representationInfo) {
            return true;
        }
        const bufferLevel = dashMetrics.getCurrentBufferLevel(type);
        return bufferLevel < getBufferTarget(type, representationInfo, hasVideoTrack);
    }

    function getBufferTarget(type, representationInfo, hasVideoTrack) {
        let bufferTarget = NaN;

        if (!type || !representationInfo) {
            return bufferTarget;
        }

        if (type === Constants.FRAGMENTED_TEXT) {
            if (textController.isTextEnabled()) {
                if (isNaN(representationInfo.fragmentDuration)) { //fragmentDuration of representationInfo is not defined,
                    // call metrics function to have data in the latest scheduling info...
                    // if no metric, returns 0. In this case, rule will return false.
                    const schedulingInfo = dashMetrics.getCurrentSchedulingInfo(MetricsConstants.SCHEDULING_INFO);
                    bufferTarget = schedulingInfo ? schedulingInfo.duration : 0;
                } else {
                    bufferTarget = representationInfo.fragmentDuration;
                }
            } else { // text is disabled, rule will return false
                bufferTarget = 0;
            }
        } else if (type === Constants.AUDIO && hasVideoTrack) {
            const videoBufferLevel = dashMetrics.getCurrentBufferLevel(Constants.VIDEO);
            if (isNaN(representationInfo.fragmentDuration)) {
                bufferTarget = videoBufferLevel;
            } else {
                bufferTarget = Math.max(videoBufferLevel, representationInfo.fragmentDuration);
            }
        } else {
            const streamInfo = representationInfo.mediaInfo.streamInfo;
            if (abrController.isPlayingAtTopQuality(streamInfo)) {
                const isLongFormContent = streamInfo.manifestInfo.duration >= settings.get().streaming.longFormContentDurationThreshold;
                bufferTarget = isLongFormContent ? settings.get().streaming.bufferTimeAtTopQualityLongForm : settings.get().streaming.bufferTimeAtTopQuality;
            } else {
                bufferTarget = mediaPlayerModel.getStableBufferTime();
            }
        }
        return bufferTarget;
    }

    const instance = {
        execute: execute,
        getBufferTarget: getBufferTarget
    };

    setup();
    return instance;
}

BufferLevelRule.__dashjs_factory_name = 'BufferLevelRule';
export default FactoryMaker.getClassFactory(BufferLevelRule);
