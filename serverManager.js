const $fs = require('fs');

const Promise = require('./promise.js');

require('./prototypes.js');

const $stateInitial = 0x00;
const $stateData = 0x01;
const $stateCache = 0x02;
const $stateWebServer = 0x04;
const $stateLoaded = 0x07;

module.exports = function(config)
{
	let _module = this;
	let _cache = {};
	let _altered = true;
	let _mongodb;
	let _startState = $stateInitial;

	_module.config = config || {};

	_module.config.app = _module.config.app || {};
	_module.config.app.file = _module.config.app.file || './app/app.js';
	_module.config.app.watchModules = (_module.config.app.watchModules == true);

	_module.config.web = _module.config.web || {};
	_module.config.web.root = (_module.config.web.root || './web/').appendTrail('/');
	_module.config.web.defaultFile = _module.config.web.defaultFile || 'index.html';
	_module.config.web.protocol = _module.config.web.protocol || 'http';
	_module.config.web.port = _module.config.web.port || 80;
	_module.config.web.postBlockLimit = _module.config.web.postBlockLimit || 1e5;
	_module.config.web.webSockets = (_module.config.web.webSockets == true);

	_module.config.cache = _module.config.cache || {}
	_module.config.cache.format = _module.config.cache.format || 'file';
	_module.config.cache.file = _module.config.cache.file || './cache.json';
	_module.config.cache.interval = (_module.config.cache.interval || 60) * 1000; // ms

	_module.config.log = _module.config.log || {};
	_module.config.log.format = _module.config.log.format || 'file';
	_module.config.log.path = (_module.config.log.path || './log/').appendTrail('/');

	let _app = require(_module.config.app.file);
	let _starting = Promise()
		.success(function(state)
		{
			_startState |= state;

			if (state === $stateData)
			{
				initCache();
			}
			if (state === $stateCache && _module.config.cache.interval != null)
			{
				setCacheInterval();
			}
			if (_startState === $stateLoaded)
			{
				_app.init(_module);
				console.log('ServerManager - app started');
			}
		});

	if (_module.config.log.format === 'mongodb' || _module.config.cache.format === 'mongodb')
	{
		// TODO: mongodb - require
		_starting.resolve($stateData);
	}
	else if (_module.config.log.format === 'mysql' || _module.config.cache.format === 'mysql')
	{
		_module.mysql = require('./mysql.js')(_module.config.mysql);

		console.log('ServerManager - MySql connected');
		
		_module.mysql.verifyTable(
				'log',
				{
					'log_id': 'BIGINT NOT NULL AUTO_INCREMENT',
					'protocol': 'VARCHAR(20) NULL',
					'status': 'VARCHAR(50) NULL',
					'duration': 'INT NULL',
					'url': 'VARCHAR(255) NULL',
					'method': 'VARCHAR(50) NULL',
					'ip': 'VARCHAR(40) NULL',
					'input': 'INT NULL',
					'output': 'INT NULL',
					'error': 'MEDIUMTEXT NULL'
				},
				['log_id']
			)
			.success(function()
			{
				_starting.resolve($stateData);
			})
			.fail(function(error)
			{
				throw(error);
			});
	}
	else
	{
		_starting.resolve($stateData);
	}

	_module.initCache = function(section, defaultData)
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

	_module.cache = function(section, data)	
	{
		if (!section)
		{
			throw 'cache section was not defined';
		}

		if (data === undefined)
		{
			return _cache[section].data; 
		}

		for (let key in data)
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

	_module.writeLog = function(protocol, status, request, startTime, err)
	{
		let duration = new Date().getTime() - (startTime || new Date().getTime());

		if (duration > 100)
		{
			console.log('slow action: ', protocol, duration);
		}

		request = request || {};

		let data = {
			protocol: protocol,
			status: status,
			duration: duration
		};
		if (request.action)
		{
			data['url'] = request.action;
		}
		else if (request.url)
		{
			data['url'] = request.url;
		}
		if (request.method)
		{
			data['method'] = request.method;
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
			data['input'] = request.inputDataLength;
		}
		if (request.outputDataLength)
		{
			data['output'] = request.outputDataLength;
		}

		if (_module.config.log.format === 'mongodb')
		{
			// TODO: mongodb 
		}
		else if (_module.config.log.format === 'mysql')
		{
			_module.mysql.insert('log', data);
		}
		else
		{
			let date = new Date();

			$fs.appendFile(
				_module.config.log.path + date.getFullYear() + '-' + (date.getMonth() + 1).leftPad(2, '0') + '-' + date.getDate().leftPad(2, '0') + '.log',
				JSON.stringify(data) + '\n',
				{ encoding: 'utf8' },
				function() {}
			);
		}
	};

	_module.restartApp = function()
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

		delete require.cache[require.resolve(_module.config.app.file)];

		_app = require(_module.config.app.file);
		_app.init(_module);
	};

	_module.setListener = function(callback)
	{
		_module.webServer.setListener(callback);
		if (_module.webSocket)
		{
			_module.webSocket.setListener(callback);
		}
	}


	if (_module.config.watchModules)
	{
		let restartTimer = null;
		let modules = [_module.config.app.file];

		if (_app.subModules)
		{
			modules = modules.concat(_app.subModules);
		}

		modules.forEach(function(item) {
			$fs.watch(item, { persistent: true }, function()
			{
				if (restartTimer === null)
				{
					clearTimeout(restartTimer);
				}
				restartTimer = setTimeout(
					function()
					{
						_module.restartApp();
						restartTimer = null;
					},
					100
				);
			});
		});
	}


	_module.webServer = new require('./webServer.js')(_module);

	_module.webServer.loading
		.success(function()
		{
			if (_module.config.web.webSockets)
			{
				_module.webSocket = new require('./webSocket.js')(_module);
			}

			_starting.resolve($stateWebServer);
		});


	function initCache()
	{
		if (_module.config.cache.format === 'mongodb')
		{
			// TODO: mongodb - read cache
			_starting.resolve($stateCache);
		}
		else if (_module.config.cache.format === 'mysql')
		{
			_module.mysql.verifyTable(
					'cache',
					{
						'section': 'VARCHAR(255) NOT NULL',
						'data': 'MEDIUMTEXT'
					},
					['section']
				)
				.success(function()
				{
					_module.mysql.query(
							'SELECT section, data FROM cache'
						)
						.success(function(data)
						{
							for (let r = 0; r < data.result.length; r++)
							{
								_cache[data.result[r].section] = {
									altered: false,
									data: JSON.parse(data.result[r].data)
								};
							}

							console.log('ServerManager - cache loaded');

							_starting.resolve($stateCache);
						})
						.fail(function(error)
						{
							throw('Unabled to read cache');
						});
				})
				.fail(function(error)
				{
					throw(error);
				});
		}
		else if ($fs.existsSync(_module.config.cache.file))
		{
			_cache = JSON.parse($fs.readFileSync(_module.config.cache.file, 'utf8'));
			_starting.resolve($stateCache);
			console.log('ServerManager - cache loaded');
		}
		else
		{
			_starting.resolve($stateCache);
		}
	} // initCache()

	function setCacheInterval()
	{
		setInterval(
			function()
			{
				if (_app.saveCache)
				{
					_app.saveCache();
				}

				if (_altered)
				{
					if (_module.config.cache.format === 'mongodb')
					{
						// TODO: mongodb - write cache
					}
					else if (_module.config.cache.format === 'mysql')
					{
						let sql = ['REPLACE LOW_PRIORITY INTO cache VALUES ']
						let list = []

						for (let c in _cache)
						{
							list.push([
								'(\'',
								c,
								'\', ',
								_module.mysql.encode(JSON.stringify(_cache[c].data)),
								')'
							].join(''));
						}

						sql.push(list.join(', '));

						_module.mysql.query(sql.join(''))
							.fail(function(error)
							{
								console.log(error)
							});
					}
					else
					{
						$fs.writeFile(
							_module.config.cache.file,
							JSON.stringify(_cache),
							{ encoding: 'utf8' }
						);
						_altered = false;
					}
				}
			},
			_module.config.cache.interval
		);
	} // setCacheInterval()

};