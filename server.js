var fs = require('fs');
var app = require('./app/app.js');

require('./prototypes.js');

new function ServerManager()
{
	var _this = this;
	var _cache = {};
	var _altered = true;
	var _mongodb;

	_this.config = require('./server.json'); 

	if (_this.config.logFormat === 'mongodb' || _this.config.dataFormat === 'mongodb')
	{
		// TODO: mongodb - require
	}

	if (_this.config.backupInterval != null)
	{
		if (_this.config.dataFormat === 'mongodb')
		{
			// TODO: mongodb - read cache
		}
		else if (fs.existsSync('./cache.json'))
		{
			_cache = JSON.parse(fs.readFileSync('./cache.json', 'utf8'));
		}

		setInterval(
			function()
			{
				if (app.saveCache)
				{
					app.saveCache();
				}

				if (_altered)
				{
					if (_this.config.dataFormat === 'mongodb')
					{
						// TODO: mongodb - write cache
					}
					else
					{
						fs.writeFile(
							'./cache.json',
							JSON.stringify(_cache),
							{ encoding: 'utf8' }
						);
						_altered = false;
					}
				}
			},
			_this.config.backupInterval * 1000
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

		var data = {
			protocol: protocol,
			status: status,
			duration: new Date().getTime() - startTime
		};
		if (request.action)
		{
			data['url'] = (request.mode ? '.' + request.mode : '') + request.action;
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

		if (_this.config.logFormat === 'mongodb')
		{
			// TODO: mongodb 
		}
		else
		{
			var date = new Date();

			fs.appendFile(
				'./log/' + date.getFullYear() + '-' + (date.getMonth() + 1).toPadded(2) + '-' + date.getDate().toPadded(2) + '.log',
				JSON.stringify(data) + '\n',
				{ encoding: 'utf8' },
				function() {}
			);
		}
	};

	var webServer = require('./webServer.js');

	_this.webServer = new webServer(_this);

	if (_this.config.webSockets)
	{
		var webSocket = require('./webSocket.js');
		_this.webSocket = new webSocket(_this);
		_this.setDefaultListener = _this.webSocket.setDefaultListener;
		_this.addModeListener = _this.webSocket.addModeListener;
	}
	else
	{
		_this.setDefaultListener = webServer.setDefaultListener;
		_this.addModeListener = webServer.addModeListener;
	}

	app.init(_this);

	console.log('ServerManager - started');
}();