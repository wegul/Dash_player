var BadWindowRule;

// Rule that selects the suitable bitrate when there is a bad window around
function BadWindowRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let Settings = factory.getSingletonFactoryByName('Settings');
    let context = this.context;
    let timeStart;
    let instance;

    /*
        AbrController.__dashjs_factory_name = 'AbrController';
                    var factory = _core_FactoryMaker__WEBPACK_IMPORTED_MODULE_7__["default"].getSingletonFactory(AbrController);
                    factory.QUALITY_DEFAULT = QUALITY_DEFAULT;
                    _core_FactoryMaker__WEBPACK_IMPORTED_MODULE_7__["default"].updateSingletonFactory(AbrController.__dashjs_factory_name, factory);

        __webpack_exports__["default"] = (factory)


        Settings.__dashjs_factory_name = 'Settings';
                    var factory = _FactoryMaker__WEBPACK_IMPORTED_MODULE_0__["default"].getSingletonFactory(Settings);
                    _FactoryMaker__WEBPACK_IMPORTED_MODULE_0__["default"].updateSingletonFactory(Settomgs.__dashjs_factory_name, factory);

        __webpack_exports__["default"] = (factory);
            */

    function setup() {
        timeStart = new Date().getTime();
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        // get controllers
        let metricsModel = MetricsModel(context).getInstance();
        let dashMetrics = DashMetrics(context).getInstance();
        let settings = Settings(context).getInstance().get();
        let mediaType = rulesContext.getMediaInfo().type;
        let streamController = StreamController(context).getInstance();
        let abrController = rulesContext.getAbrController();

        // get info
        const mediaInfo = rulesContext.getMediaInfo();
        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;

        // get metrics
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo().id);
        const bitrateList = abrController.getBitrateList(mediaInfo);
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);
        const latency = throughputHistory.getAverageLatency(mediaType);
        const targetBufferLevel = settings.streaming.buffer.stableBufferTime;
        const badWndLength = settings.streaming.buffer.badWindowLength;


        // If already in lowest bitrate or no bad window approaching, don't do anything
        if (badWndLength <= 0 || current === 0) {
            let sr = SwitchRequest(context).create();
            return sr;
            // return SwitchRequest(context).create();
        }

        // T-ODO: Ask to fulfill the buffer according to stable buffer time (aka targetBufferLevel)
        //  and bad window length (aka badWndLength)  // done

        //TODO: get the time span of each segment

        // presumably set historical throughput as 3000 kbits/s
        const historicalThroughput = 3000 + 0.5, totalBits = historicalThroughput * badWndLength/*kbits*/;
        let targetQuality = 0, targetBitrate = 0;

        for (let i = bitrateList.length - 1; i >= 0; i--) {
            const bitrateInfo = bitrateList[i];
            if (historicalThroughput * 1000 >= bitrateInfo.bitrate) {
                targetQuality = i;
                break;
            }
        }
        const infoLog = {
            timestamp: (new Date().getTime() - timeStart) / 1000,
            BSset: 'unknown',
            currentThroughput_kbits_ps: throughput,
            historicalThroughput: historicalThroughput,
            currentBuflev: bufferLevel,
            targetBuflev: targetBufferLevel,
            targetQuality: targetQuality
        }
        console.log(infoLog);
        fillTable(infoLog);


        let switchRequest = SwitchRequest(context).create();
        switchRequest.quality = targetQuality;//-1 is no change
        switchRequest.reason = 'bad window in coming';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
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

    instance = {
        getMaxIndex: getMaxIndex
    };


    setup();

    return instance;
}

BadWindowRuleClass.__dashjs_factory_name = 'BadWindowRule';
BadWindowRule = dashjs.FactoryMaker.getClassFactory(BadWindowRuleClass);

function Log() {

}