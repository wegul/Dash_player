var ThroughputPredictionRule;

function ThroughputPredictionRuleClass(config) {
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let Settings = factory.getSingletonFactoryByName('Settings');
    let context = this.context;
    let timeStart;
    let instance, logger;
    let dashMetrics, streamController;

    config = config || {};


    function setup() {
        dashMetrics = DashMetrics(context).getInstance();
        streamController = StreamController(context).getInstance();
        timeStart = new Date().getTime();
    }

    function checkConfig() {
        if (!dashMetrics || !dashMetrics.hasOwnProperty('getCurrentBufferState')) {
            console.log("check config")
            throw new Error(Constants.MISSING_CONFIG_ERROR);
        }
    }

    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();
        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getMediaType') || !rulesContext.hasOwnProperty('useBufferOccupancyABR') ||
            !rulesContext.hasOwnProperty('getAbrController') || !rulesContext.hasOwnProperty('getScheduleController')) {
            console.log("00 if");
            return switchRequest;
        }

        checkConfig();


        const mediaInfo = rulesContext.getMediaInfo();
        const mediaType = rulesContext.getMediaType();
        const currentBufferState = dashMetrics.getCurrentBufferState(mediaType);
        const scheduleController = rulesContext.getScheduleController();
        const abrController = rulesContext.getAbrController();
        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;


        // get metrics
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);
        const latency = throughputHistory.getAverageLatency(mediaType);
        const useBufferOccupancyABR = rulesContext.useBufferOccupancyABR();

        if (isNaN(throughput) || !currentBufferState || useBufferOccupancyABR) {
            if (useBufferOccupancyABR) {
                console.log({throughput, currentBufferState, bufferLevel});
            }
            return switchRequest;
        }
        // console.log(abrController.getAbandonmentStateFor(streamInfo.id,mediaType));
        if (abrController.getAbandonmentStateFor(streamInfo.id, mediaType) !== 'abandonload') {
            if (currentBufferState.state === 'bufferLoaded') {
                switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
                switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, throughput, streamInfo.id, latency);
                scheduleController.setTimeToLoadDelay(0);
                // logger.debug('[' + mediaType + '] requesting switch to index: ', switchRequest.quality, 'Average throughput', Math.round(throughput), 'kbps');
                switchRequest.reason = {throughput: throughput, latency: latency};
            }
        }
        const infoLog = {
            timestamp: (new Date().getTime() - timeStart) / 1000,
            currentThroughput_kbits_ps: throughput,
            historicalThroughput: 'default',
            currentBuflev: bufferLevel,
            targetQuality: abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo().id)
        }
        console.log(infoLog);
        fillTable(infoLog);
        return switchRequest;
    }

    function fillTable(infoLog) {
        let table = document.getElementById('tbMain'),
            row = table.insertRow();
        for (let t in infoLog) {
            let cell = row.insertCell();
            cell.innerText = infoLog[t];
        }
    }

    function reset() {
        // no persistent information to reset
    }

    instance = {
        getMaxIndex: getMaxIndex,
        reset: reset
    };

    setup();

    return instance;
}

ThroughputPredictionRuleClass.__dashjs_factory_name = 'ThroughputPredictionRule';
ThroughputPredictionRule = dashjs.FactoryMaker.getClassFactory(ThroughputPredictionRuleClass);
