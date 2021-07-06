/**
 * Returns a switch request object indicating which quality is to be played
 * @param {object} rulesContext
 * @return {object}
 */
function getMaxIndex(rulesContext) {
    const switchRequest = SwitchRequest(context).create();
    const horizon = 4; // Optimization horizon (The amount of steps required to achieve convergence)
    const vl = Math.pow(horizon, 0.99);// Cautiousness parameter, used to control aggressiveness of the bitrate decision process.
    const alpha = Math.max(Math.pow(horizon, 1), vl * Math.sqrt(horizon));// Step size, used for gradient descent exploration granularity
    const mediaInfo = rulesContext.getMediaInfo();
    const mediaType = rulesContext.getMediaType();
    const bitrates = mediaInfo.bitrateList.map(b => b.bandwidth);
    const bitrateCount = bitrates.length;
    const scheduleController = rulesContext.getScheduleController();
    const streamInfo = rulesContext.getStreamInfo();
    const abrController = rulesContext.getAbrController();
    const throughputHistory = abrController.getThroughputHistory();
    const isDynamic = streamInfo && streamInfo.manifestInfo && streamInfo.manifestInfo.isDynamic;
    const useL2AABR = rulesContext.useL2AABR();
    const bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType, true);
    const safeThroughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);
    const throughput = throughputHistory.getAverageThroughput(mediaType, isDynamic); // In kbits/s
    const react = 2; // Reactiveness to volatility (abrupt throughput drops), used to re-calibrate Lagrangian multiplier Q
    const latency = throughputHistory.getAverageLatency(mediaType);
    const videoModel = rulesContext.getVideoModel();
    let quality;
    let currentPlaybackRate = videoModel.getPlaybackRate();

    if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getMediaType') ||
        !rulesContext.hasOwnProperty('getScheduleController') || !rulesContext.hasOwnProperty('getStreamInfo') ||
        !rulesContext.hasOwnProperty('getAbrController') || !rulesContext.hasOwnProperty('useL2AABR')) {
        return switchRequest;
    }

    switchRequest.reason = switchRequest.reason || {};

    if ((!useL2AABR) || (mediaType === Constants.AUDIO)) {// L2A decides bitrate only for video. Audio to be included in decision process in a later stage
        return switchRequest;
    }

    scheduleController.setTimeToLoadDelay(0);

    const l2AState = _getL2AState(rulesContext);

    if (l2AState.state === L2A_STATE_ONE_BITRATE) {
        // shouldn't even have been called
        return switchRequest;
    }

    const l2AParameter = l2AParameterDict[mediaType];

    if (!l2AParameter) {
        return switchRequest;
    }

    switchRequest.reason.state = l2AState.state;
    switchRequest.reason.throughput = throughput;
    switchRequest.reason.latency = latency;

    if (isNaN(throughput)) {
        // still starting up - not enough information
        return switchRequest;
    }

    switch (l2AState.state) {
        case L2A_STATE_STARTUP:
            quality = abrController.getQualityForBitrate(mediaInfo, safeThroughput, streamInfo.id, latency);//During strat-up phase abr.controller is responsible for bitrate decisions.
            switchRequest.quality = quality;
            switchRequest.reason.throughput = safeThroughput;
            l2AState.lastQuality = quality;

            if (!isNaN(l2AState.lastSegmentDurationS) && bufferLevel >= l2AParameter.B_target) {
                l2AState.state = L2A_STATE_STEADY;
                l2AParameter.Q = vl;// Initialization of Q langrangian multiplier
                // Update of probability vector w, to be used in main adaptation logic of L2A below (steady state)
                for (let i = 0; i < bitrateCount; ++i) {
                    if (i === l2AState.lastQuality) {
                        l2AParameter.prev_w[i] = 1;
                    } else {
                        l2AParameter.prev_w[i] = 0;
                    }
                }
            }

            break; // L2A_STATE_STARTUP
        case L2A_STATE_STEADY:
            let diff1 = [];//Used to calculate the difference between consecutive decisions (w-w_prev)

            // Manual calculation of latency and throughput during previous request
            let throughputMeasureTime = dashMetrics.getCurrentHttpRequest(mediaType).trace.reduce((a, b) => a + b.d, 0);
            const downloadBytes = dashMetrics.getCurrentHttpRequest(mediaType).trace.reduce((a, b) => a + b.b[0], 0);
            let lastthroughput = Math.round((8 * downloadBytes) / throughputMeasureTime); // bits/ms = kbits/s

            if (lastthroughput < 1) {
                lastthroughput = 1;
            }//To avoid division with 0 (avoid infinity) in case of an absolute network outage

            let V = l2AState.lastSegmentDurationS;
            let sign = 1;

            //Main adaptation logic of L2A-LL
            for (let i = 0; i < bitrateCount; ++i) {
                bitrates[i] = bitrates[i] / 1000; // Originally in bps, now in Kbps
                if (currentPlaybackRate * bitrates[i] > lastthroughput) {// In this case buffer would deplete, leading to a stall, which increases latency and thus the particular probability of selsection of bitrate[i] should be decreased.
                    sign = -1;
                }
                // The objective of L2A is to minimize the overall latency=request-response time + buffer length after download+ potential stalling (if buffer less than chunk downlad time)
                l2AParameter.w[i] = l2AParameter.prev_w[i] + sign * (V / (2 * alpha)) * ((l2AParameter.Q + vl) * (currentPlaybackRate * bitrates[i] / lastthroughput));//Lagrangian descent
            }

            // Apply euclidean projection on w to ensure w expresses a probability distribution
            l2AParameter.w = euclideanProjection(l2AParameter.w);

            for (let i = 0; i < bitrateCount; ++i) {
                diff1[i] = l2AParameter.w[i] - l2AParameter.prev_w[i];
                l2AParameter.prev_w[i] = l2AParameter.w[i];
            }

            // Lagrangian multiplier Q calculation:
            l2AParameter.Q = Math.max(0, l2AParameter.Q - V + V * currentPlaybackRate * ((_dotmultiplication(bitrates, l2AParameter.prev_w) + _dotmultiplication(bitrates, diff1)) / lastthroughput));

            // Quality is calculated as argmin of the absolute difference between available bitrates (bitrates[i]) and bitrate estimation (dotmultiplication(w,bitrates)).
            let temp = [];
            for (let i = 0; i < bitrateCount; ++i) {
                temp[i] = Math.abs(bitrates[i] - _dotmultiplication(l2AParameter.w, bitrates));
            }

            // Quality is calculated based on the probability distribution w (the output of L2A)
            quality = temp.indexOf(Math.min(...temp));

            // We employ a cautious -stepwise- ascent
            if (quality > l2AState.lastQuality) {
                if (bitrates[l2AState.lastQuality + 1] <= lastthroughput) {
                    quality = l2AState.lastQuality + 1;
                }
            }

            // Provision against bitrate over-estimation, by re-calibrating the Lagrangian multiplier Q, to be taken into account for the next chunk
            if (bitrates[quality] >= lastthroughput) {
                l2AParameter.Q = react * Math.max(vl, l2AParameter.Q);
            }

            switchRequest.quality = quality;
            switchRequest.reason.throughput = throughput;
            switchRequest.reason.latency = latency;
            switchRequest.reason.bufferLevel = bufferLevel;
            l2AState.lastQuality = switchRequest.quality;
            break;
        default:
            // should not arrive here, try to recover
            logger.debug('L2A ABR rule invoked in bad state.');
            switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, safeThroughput, streamInfo.id, latency);
            switchRequest.reason.state = l2AState.state;
            switchRequest.reason.throughput = safeThroughput;
            switchRequest.reason.latency = latency;
            l2AState.state = L2A_STATE_STARTUP;
            _clearL2AStateOnSeek(l2AState);
    }
    return switchRequest;
}