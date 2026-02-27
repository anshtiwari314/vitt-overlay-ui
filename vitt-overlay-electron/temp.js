// assembly ai 
  // recording_config: {
  //   transcript: {
  //     provider: {
  //       assembly_ai_v3_streaming: {
  //         // any additional AssemblyAI real-time params
  //       }
  //     }
  //   },
  //   realtime_endpoints: [
  //     {
  //       type: 'desktop_sdk_callback',
  //       events: ['transcript.data', 'transcript.partial_data']
  //     }
  //   ]
  // }

    //deepgram 
    // "recording_config": {
    //   "transcript": {
    //     "provider": {
    //       "deepgram_streaming": {
    //         // "model": "nova-2",
    //         // "language": "en",
    //         // "punctuate": true,
    //         // "smart_format": true,
    //         // "diarize": true
    //       }
    //     }
    //   },
    //   "realtime_endpoints": [
    //     {
    //       "type": "desktop_sdk_callback",
    //       "events": [
    //         "transcript.partial_data",
    //         "transcript.data"
    //       ]
    //     }
    //   ]
    // }


    //recall.ai 

    // recording_config: {
    //   transcript: {
    //     provider: {
    //       recallai_streaming: {}
    //     }
    //   },
    //   realtime_endpoints: [
    //     {
    //       type: 'desktop_sdk_callback',
    //       events: ['transcript.data', 'transcript.partial_data']
    //     }
    //   ]
    // }

    //Gladia

    // {
    //   "transcript": {
    //     "provider": {
    //       "gladia_v2_streaming": {
    //         "model": "solaria-1"
    //       }
    //     }
    //   },
    //   "realtime_endpoints": [
    //     {
    //       type: 'desktop_sdk_callback',
    //       events: ['transcript.data', 'transcript.partial_data']
    //     }
    //   ]
    // }