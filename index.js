'use strict';

var http = require('http'), assert = require('assert'), zlib = require('zlib'), fs = require('fs');

var api = {
	setHeaders : function(res, obj){
		for(var i in obj){
			res.setHeader(i, obj[i]);
		}
	},
	
	parseRange : function(str){
		assert('string' == typeof str, 'Invalid argument');
		var arr = str.split('-');
		return arr[1] == '' ? {start: +arr[0] || 0} : {start: +arr[0] || 0, end: +arr[1]};
	}
};

module.exports = function(req, res, done){
	assert(req instanceof http.IncomingMessage, 'Invalid Argument');
	assert(res instanceof http.ServerResponse, 'Invalid Argument');
	assert('function' == typeof done, 'Invalid Argument');
	
	res.send = function(){
		assert(arguments.length ==2 || arguments.length == 1, 'Invalid arguments');
		
		var options = {}, data = new Buffer('');
		if(arguments.length == 2){
			options = arguments[0];
			data = arguments[1];
		}else{
			data = arguments[0];
		}
		
		if(req.headers.range){
			options.range = api.parseRange(req.headers.range);
		}
		
		assert('object' == typeof options, 'Invalid options');
		assert('string' == typeof data || data instanceof Buffer, 'Invalid data');
		
		res.statusCode = options.code || 200;
		if('object' == typeof options.headers) api.setHeaders(res, options.headers);
		
		if('string' == typeof data){
			fs.stat(data, function(err, stat){
				if(err){
					res.statusCode = 404;
					res.end('');
					return;
				}
				
				// res.setHeader('content-length', stat.size);
				var frs = options.range ? fs.createReadStream(data, options.range) : fs.createReadStream(data);
				
				if(options.range){
					res.setHeader('content-range', '' + (options.range.start || '0') + '-' + (options.range.end || stat.size) + '/' + stat.size);
					res.statusCode = 206;
					// res.setHeader('content-length', '' + (options.range.end || stat.size) - (options.range.start || 0));
				}
				
				if(options.encoding){
					var enc = options.encoding.match(/(gzip|deflate)/);
					if(enc){
						if(enc[0] == 'gzip'){
							frs.pipe(zlib.createGzip()).pipe(res);
						}else{
							frs.pipe(zlib.createDeflate()).pipe(res);
						}
					}else{
						frs.pipe(res);
					}
				}else{
					frs.pipe(res);
				}
			});
		}else{
			// res.setHeader('content-length', data.length);
			if('object' == typeof options.range){
				res.setHeader('content-range', '' + (options.range.start || '0') + '-' + (options.range.end || data.length) + '/' + data.length);
				data = data.slice(options.range.start || 0, options.range.end || data.length);
				res.statusCode = 206;
				// res.setHeader('content-length', '' + (options.range.end || data.length) - (options.range.start || 0))
			}
			
			if('string' == typeof options.encoding){
				var enc = options.encoding.match(/(gzip|deflate)/);
				if(enc){
					res.setHeader('content-encoding', enc[0]);
					zlib[enc[0]].call(this, data, function(err, result){
						assert(!err, err.message);
						
						res.end(result);
					});
				}else{
					res.end(data);
				}
			}else{
				res.end(data);
			}
		}
	};
	
	done();
}