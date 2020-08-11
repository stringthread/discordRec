/*
(The MIT License)
Copyright (c) 2011 Tom Medema <tommedema@gmail.com>, based on Node-Fluent-FFmpeg Copyright (c) 2011 Stefan Schaermeli <schaermu@gmail.com>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction,
 including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    ffmpegProcessor = require('./ffmpegProcessor');

//creates a new processor object
var createProcessor = function (options) {
    //validate options such as niceness, make sure that required options are set
    if (!options.outputStream) throw 'output stream is not set';
    if (options.niceness && (options.niceness < -20 || options.niceness > 19)) throw 'niceness cannot be lower than -20 or higher than 19';
    if (!options.arguments) options.arguments = {};
    if (!'endInputStream' in options) options.endInputStream = true;
    if (!'endOutputStream' in options) options.endOutputStream = true;

    //create new processor, starts as an event emitter
    var processor = new EventEmitter();

    //set processor options
    processor.options = options;

    //initialize an empty state
    processor.state = {
            timeoutTimer: null
          , childProcess: null
          , inputWriteBufferEmpty: true
          , tmpStderrOutput: ''
          , emitInputAudioCodecEvent: options.emitInputAudioCodecEvent
    };

    //add execution and termination methods
    processor.execute = function() {
        ffmpegProcessor.execute(processor);

        //return processor to allow chaining
        return processor;
    };
    processor.terminate = function(signal) { //signal is optional
        ffmpegProcessor.terminate(processor, signal);

        //return processor to allow chaining
        return processor;
    };

    //return this processor
    return processor;
};

//public functions
exports.createProcessor = createProcessor;
