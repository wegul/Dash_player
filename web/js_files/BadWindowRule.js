var BadWindowRule;

// Rule that selects the suitable bitrate when there is a bad window around
function BadWindowRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let ScheduleController = factory.getClassFactoryByName('ScheduleController');
    let context = this.context;
    let timeStart;
    let badWndBufferTarget = 88;
    let instance;

    function setup() {
        timeStart = new Date().getTime();
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        // here you can get some informations aboit metrics for example, to implement the rule
        let metricsModel = MetricsModel(context).getInstance();
        let dashMetrics = DashMetrics(context).getInstance();
        let scheduleController = ScheduleController(context).create();
        let mediaType = rulesContext.getMediaInfo().type;

        // console.log(scheduleController);
        let bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);

        // A smarter (real) rule could need analyze playback metrics to take
        // bitrate switching decision. Printing metrics here as a reference


        // Get current bitrate
        let streamController = StreamController(context).getInstance();
        let abrController = rulesContext.getAbrController();
        let current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo().id);

        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);


        console.log({
            "timestamp": (new Date().getTime() - timeStart) / 1000,
            "buflev": bufferLevel,
            "throughput kbits/s": throughput
        });

        // If already in lowest bitrate, don't do anything
        if (badWndBufferTarget < 0 || current === 0) {
            let sr = SwitchRequest(context).create();
            return sr;
            // return SwitchRequest(context).create();
        }

        // Ask to fulfill the buffer according to badWndBufferTarget

        // scheduleController.setBufferTarget(badWndBufferTarget);
        // console.log({'target':scheduleController.getBufferTarget()});

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

