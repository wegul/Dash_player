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
    let badWndBufferTarget = 88;
    let instance;

    function setup() {
        timeStart = new Date().getTime();
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        // get controllers
        let metricsModel = MetricsModel(context).getInstance();
        let dashMetrics = DashMetrics(context).getInstance();
        let settings = Settings.getInstance();
        let mediaType = rulesContext.getMediaInfo().type;
        let streamController = StreamController(context).getInstance();
        let abrController = rulesContext.getAbrController();

        // get metrics
        const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        const current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo().id);
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);

        // get info
        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;


        console.log({
            "timestamp": (new Date().getTime() - timeStart) / 1000,
            "buflev": bufferLevel,
            "throughput kbits/s": throughput
        });

        // If already in lowest bitrate or no bad window approaching, don't do anything
        if (badWndBufferTarget < 0 || current === 0) {
            let sr = SwitchRequest(context).create();
            return sr;
            // return SwitchRequest(context).create();
        }

        // Ask to fulfill the buffer according to stable buffer time aka targetBufferLevel

        const targetBufferLevel=settings.getBufferTarget();
        console.log({'target':targetBufferLevel});

        let switchRequest = SwitchRequest(context).create();
        switchRequest.quality = 1;//-1 is no change
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

