var fs = require('fs');

require('./prototypes.js');

module.exports = function(config)
{
	var _this = this;
	var _cache = {};
	var _altered = true;
	var _mongodb;

	_this.config = config || {};

	_this.config.app = _this.config.app || {};
	_this.config.app.file = _this.config.app.file || './app/app.js';
	_this.config.app.watchModules = (_this.config.app.watchModules == true);

	_this.config.web = _this.config.web || {};
	_this.config.web.root = (_this.config.web.root || './web/').appendTrail('/');
	_this.config.web.defaultFile = _this.config.web.defaultFile || 'index.html';
	_this.config.web.protocol = _this.config.web.protocol || 'http';
	_this.config.web.port = _this.config.web.port || 80;
	_this.config.web.postBlockLimit = _this.config.web.postBlockLimit || 1e5;
	_this.config.web.webSockets = (_this.config.web.webSockets == true);
	_this.config.web.userTracking = (_this.config.web.userTracking || 'localStorage');

	_this.config.cache = _this.config.cache || {}
	_this.config.cache.format = _this.config.cache.format || 'file';
	_this.config.cache.file = _this.config.cache.file || './cache.json';
	_this.config.cache.interval = (_this.config.cache.interval || 60) * 1000; // ms

	_this.config.log = _this.config.log || {};
	_this.config.log.format = _this.config.log.format || 'file';
	_this.config.log.path = (_this.config.log.path || './log/').appendTrail('/');

	var _app = require(_this.config.app.file);

	if (_this.config.log.format === 'mongodb' || _this.config.cache.format === 'mongodb')
	{
		// TODO: mongodb - require
	}

	if (_this.config.log.format === 'mysql' || _this.config.cache.format === 'mysql')
	{
		// TODO: mysql - require
	}

	if (_this.config.cache.interval != null)
	{

		if (_this.config.cache.format === 'mongodb')
		{
			// TODO: mongodb - read cache
		}
		else if (_this.config.cache.format === 'mysql')
		{
			// TODO: mysql - read cache
		}
		else if (fs.existsSync(_this.config.cache.file))
		{
			_cache = JSON.parse(fs.readFileSync(_this.config.cache.file, 'utf8'));
		}

		setInterval(
			function()
			{
				if (_app.saveCache)
				{
					_app.saveCache();
				}

				if (_altered)
				{
					if (_this.config.cache.format === 'mongodb')
					{
						// TODO: mongodb - write cache
					}
					else if (_this.config.cache.format === 'mysql')
					{
						// TODO: mysql - write cache
					}
					else
					{
						fs.writeFile(
							_this.config.cache.file,
							JSON.stringify(_cache),
							{ encoding: 'utf8' }
						);
						_altered = false;
					}
				}
			},
			_this.config.cache.interval
		);
	}

	_this.initCache = function(section, defaultData)
	{
		if (!section)
		{
			throw 'cache section was not defined';
		}

		if (_cache[section] === undefined)
		{
			_cache[section] = {
				altered: false,
				data: defaultData
			};
		}
	};

	_this.cache = function(section, data)	
	{
		if (!section)
		{
			throw 'cache section was not defined';
		}

		if (data === undefined)
		{
			return _cache[section].data; 
		}

		for (var key in data)
		{
			if (data[key] === null)
			{
				delete _cache[section].data[key];
			}
			else
			{
				_cache[section].data[key] = data[key];
			}
		}

		_cache[section].altered = true;
	};

	_this.writeLog = function(protocol, status, request, startTime, err)
	{
		startTime = startTime || new Date().getTime();
		request = request || {};

		var data = {
			protocol: protocol,
			status: status,
			duration: new Date().getTime() - startTime
		};
		if (request.action)
		{
			data['url'] = request.action;
		}
		else if (request.url)
		{
			data['url'] = request.url;
		}
		if (request.connection)
		{
			data['ip'] = request.connection.remoteAddress;
		}
		if (err)
		{
			data['error'] = err;
		}

		if (request.inputDataLength)
		{
			data['inputDataLength'] = request.inputDataLength;
		}
		if (request.outputDataLength)
		{
			data['outputDataLength'] = request.outputDataLength;
		}

		if (_this.config.log.format === 'mongodb')
		{
			// TODO: mongodb 
		}
		else if (_this.config.log.format === 'mysql')
		{
			// TODO: mysql 
		}
		else
		{
			var date = new Date();

			fs.appendFile(
				_this.config.log.path + date.getFullYear() + '-' + (date.getMonth() + 1).toPadded(2) + '-' + date.getDate().toPadded(2) + '.log',
				JSON.stringify(data) + '\n',
				{ encoding: 'utf8' },
				function() {}
			);
		}
	};

	_this.restartApp = function()
	{
		console.log('Recycling modules...');
		if (_app.subModules)
		{
			_app.subModules.forEach(
				function(module)
				{
					delete require.cache[require.resolve(module)];
				}
			);
		}
		delete require.cache[require.resolve(_this.config.app.file)];

		_app = require(_this.config.app.file);
		_app.init(_this);
	};

	_this.setListener = function(callback)
	{
		_this.webServer.setListener(callback);
		if (_this.webSocket)
		{
			_this.webSocket.setListener(callback);
		}
	}


	if (_this.config.watchModules)
	{
		var restartTimer = null;
		var modules = [_this.config.app.file];

		if (_app.subModules)
		{
			modules = modules.concat(_app.subModules);
		}

		modules.forEach(function(item) {
			fs.watch(item, { persistent: true }, function()
			{
				if (restartTimer === null)
				{
					clearTimeout(restartTimer);
				}
				restartTimer = setTimeout(
					function()
					{
						_this.restartApp();
						restartTimer = null;
					},
					100
				);
			});
		});
	}


	var webServer = require('./webServer.js');

	_this.webServer = new webServer(_this);

	if (_this.config.web.webSockets)
	{
		var webSocket = require('./webSocket.js');

		_this.webSocket = new webSocket(_this);
	}
	

	_app.init(_this);

	console.log('ServerManager - started');
};