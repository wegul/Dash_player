var BadWindowRule;

// Rule that selects the suitable bitrate when there is a bad window around
function BadWindowRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let context = this.context;
    let timeSpan = -1;
    let instance;

    function setup(time) {
        timeSpan = time;
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        // here you can get some informations aboit metrics for example, to implement the rule
        let metricsModel = MetricsModel(context).getInstance();
        let dashMetrics = DashMetrics(context).getInstance();
        let mediaType = rulesContext.getMediaInfo().type;
        let metrics = metricsModel.getMetricsFor(mediaType, true);
        let bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        // A smarter (real) rule could need analyze playback metrics to take
        // bitrate switching decision. Printing metrics here as a reference
        console.log({"buflev": bufferLevel});


        // Get current bitrate
        let streamController = StreamController(context).getInstance();
        let abrController = rulesContext.getAbrController();
        let current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo().id);

        // If already in lowest bitrate, don't do anything
        if (timeSpan > 0 || current === 0) {
            let sr = SwitchRequest(context).create();
            return sr;
            // return SwitchRequest(context).create();
        }

        // Ask to fulfill the buffer
        let switchRequest = SwitchRequest(context).create();
        switchRequest.quality = 0;//-1 is no change
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
BadWindowRule = dashjs.FactoryMaker.getClassFactory(BadWindowRuleRuleClass);

