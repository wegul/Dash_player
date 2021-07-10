var BadWindowRule;

// Rule that selects the suitable bitrate when there is a bad window around
function BadWindowRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let Settings = factory.getSingletonFactoryByName('Settings');
    // let Settings =factory.getSingletonFactory(Settings)
    // Object(_core_Settings__WEBPACK_IMPORTED_MODULE_28__["default"])(context).getInstance();
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
        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;

        // get metrics
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo().id);
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);

        // If already in lowest bitrate or no bad window approaching, don't do anything
        const targetBufferLevel=settings.streaming.buffer.stableBufferTime;


        console.log({
            "timestamp": (new Date().getTime() - timeStart) / 1000,
            "BS set":'unknown',
            "current throughput kbits/s": throughput,
            "historical throughput":'unknown',
            "current buflev": bufferLevel,
            "target buflev":targetBufferLevel
        });

        if (targetBufferLevel <= 0 || current === 0) {
            let sr = SwitchRequest(context).create();
            return sr;
            // return SwitchRequest(context).create();
        }

        // Ask to fulfill the buffer according to stable buffer time aka targetBufferLevel

        let switchRequest = SwitchRequest(context).create();
        switchRequest.quality = 8;//-1 is no change
        switchRequest.reason = 'bad window in coming';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
        return switchRequest;
    }

    instance = {
        getMaxIndex: getMaxIndex
    };

    setup();

    return instance;
}

BadWindowRuleClass.__dashjs_factory_name = 'BadWindowRule';
BadWindowRule = dashjs.FactoryMaker.getClassFactory(BadWindowRuleClass);

