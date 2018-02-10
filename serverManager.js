const $fs = require('fs');

const Promise = require('./promise.js');

require('./prototypes.js');

const $stateInitial = 0x00;
const $stateData = 0x01;
const $stateCache = 0x02;
const $stateWebServer = 0x04;
const $stateLoaded = 0x07;

module.exports = (config) =>
{
	let _serverManager = this;
	let _cache = {};
	let _altered = true;
	let _startState = $stateInitial;

	_serverManager.config = config || {};

	_serverManager.config.app = _serverManager.config.app || {};
	_serverManager.config.app.file = _serverManager.config.app.file || './app/app.js';
	_serverManager.config.app.watchModules = (_serverManager.config.app.watchModules == true);

	_serverManager.config.web = _serverManager.config.web || {};
	_serverManager.config.web.root = (_serverManager.config.web.root || './web/').appendTrail('/');
	_serverManager.config.web.defaultFile = _serverManager.config.web.defaultFile || 'index.html';
	_serverManager.config.web.protocol = _serverManager.config.web.protocol || 'http';
	_serverManager.config.web.port = _serverManager.config.web.port || 80;
	_serverManager.config.web.postBlockLimit = _serverManager.config.web.postBlockLimit || 1e5;
	_serverManager.config.web.webSockets = (_serverManager.config.web.webSockets == true);

	_serverManager.config.cache = _serverManager.config.cache || {}
	_serverManager.config.cache.format = _serverManager.config.cache.format || 'file';
	_serverManager.config.cache.file = _serverManager.config.cache.file || './cache.json';
	_serverManager.config.cache.interval = (_serverManager.config.cache.interval || 60) * 1000; // ms

	_serverManager.config.log = _serverManager.config.log || {};
	_serverManager.config.log.format = _serverManager.config.log.format || 'file';
	_serverManager.config.log.path = (_serverManager.config.log.path || './log/').appendTrail('/');

	let _app = require(_serverManager.config.app.file);
	let _starting = new Promise()
		.success((state) =>
		{
			_startState |= state;

			if (state === $stateData)
			{
				initCache();
			}
			if (state === $stateCache && _serverManager.config.cache.interval != null)
			{
				setCacheInterval();
			}
			if (_startState === $stateLoaded)
			{
				_app.init(_serverManager);
				console.log('ServerManager - App started');
			}
		});

	if (_serverManager.config.log.format === 'mongoose' || _serverManager.config.cache.format === 'mongoose' || _serverManager.config.app.database === 'mongoose')
	{
		// TODO: mongoose
		_starting.resolve($stateData);
	}
	else if (_serverManager.config.log.format === 'mysql' || _serverManager.config.cache.format === 'mysql' || _serverManager.config.app.database === 'mysql')
	{
		_serverManager.mysql = require('./mysql.js')(_serverManager.config.mysql);
		_serverManager.mysql.starting
			.success(() =>
			{
				console.log('ServerManager - MySql connected');
				
				_serverManager.mysql.verifyTable(
						'log',
						{
							'log_id'   : 'BIGINT NOT NULL AUTO_INCREMENT',
							'protocol' : 'VARCHAR(20) NULL',
							'status'   : 'VARCHAR(50) NULL',
							'duration' : 'INT NULL',
							'url'      : 'VARCHAR(255) NULL',
							'method'   : 'VARCHAR(50) NULL',
							'ip'       : 'VARCHAR(40) NULL',
							'input'    : 'INT NULL',
							'output'   : 'INT NULL',
							'error'    : 'MEDIUMTEXT NULL'
						},
						['log_id']
					)
					.success(() =>
					{
						console.log('ServerManager - MySql database structure verified');
						_starting.resolve($stateData);
					})
					.fail((error) =>
					{
						console.log('ServerManager - MySql database structure verification failed:');
						console.log(error);
						process.exit();
					});
			})
			.fail((error) =>
			{
				setTimeout(() =>
				{
					console.log('ServerManager - MySql connection failed:');
					console.log(error);
					process.exit();
				});
			});
	}
	else
	{
		_starting.resolve($stateData);
	}

	_serverManager.initCache = (section, defaultData) =>
	{
		if (!section)
		{
			console.log('ServerManager - cache section was not defined');
			process.exit();
		}

		if (_cache[section] === undefined)
		{
			_cache[section] = {
				altered: false,
				data: defaultData
			};
		}
	};

	_serverManager.cache = (section, data)	=>
	{
		if (!section)
		{
			console.log('ServerManager - Cache section was not defined');
			process.exit();
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

	_serverManager.writeLog = (protocol, status, request, startTime, err) =>
	{
		let duration = new Date().getTime() - (startTime || new Date().getTime());

		if (duration > 100)
		{
			console.log('ServerManager - Slow action: ', protocol, status, duration);
		}

		request = request || {};

		let data = {
			protocol: protocol,
			status: status,
			duration: duration
		};
		if (request.action)
		{
			data['action'] = request.action;
		}
		else if (request.url)
		{
			data['action'] = request.url;
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

		if (_serverManager.config.log.format === 'mongoose')
		{
			// TODO: mongoose 
		}
		else if (_serverManager.config.log.format === 'mysql')
		{
			_serverManager.mysql.insert('log', data);
		}
		else
		{
			let date = new Date();

			$fs.appendFile(
				[_serverManager.config.log.path, date.getFullYear(), '-', (date.getMonth() + 1).leftPad(2, '0'), '-', date.getDate().leftPad(2, '0'), '.log'].join(''),
				JSON.stringify(data) + '\n',
				{ encoding: 'utf8' },
				() => {}
			);
		}
	};

	_serverManager.restartApp = () =>
	{
		console.log('Recycling modules...');

		if (_app.subModules)
		{
			_app.subModules.forEach((module) =>
			{
				delete require.cache[require.resolve(module)];
			});
		}

		delete require.cache[require.resolve(_serverManager.config.app.file)];

		_app = require(_serverManager.config.app.file);
		_app.init(_serverManager);
	};

	_serverManager.setListener = (callback) =>
	{
		_serverManager.webServer.setListener(callback);
		if (_serverManager.webSocket)
		{
			_serverManager.webSocket.setListener(callback);
		}
	}


	if (_serverManager.config.watchModules)
	{
		let restartTimer = null;
		let modules = [_serverManager.config.app.file];

		if (_app.subModules)
		{
			modules = modules.concat(_app.subModules);
		}

		modules.forEach((item) =>
		{
			$fs.watch(item, { persistent: true }, function()
			{
				if (restartTimer === null)
				{
					clearTimeout(restartTimer);
				}
				restartTimer = setTimeout(
					function()
					{
						_serverManager.restartApp();
						restartTimer = null;
					},
					100
				);
			});
		});
	}


	_serverManager.webServer = new require('./webServer.js')(_serverManager);

	_serverManager.webServer.loading
		.success(() =>
		{
			if (_serverManager.config.web.webSockets)
			{
				_serverManager.webSocket = new require('./webSocket.js')(_serverManager);
			}

			_starting.resolve($stateWebServer);
		});


	function initCache()
	{
		if (_serverManager.config.cache.format === 'mongoose')
		{
			// TODO: mongoose - read cache
			_starting.resolve($stateCache);
		}
		else if (_serverManager.config.cache.format === 'mysql')
		{
			_serverManager.mysql.verifyTable(
					'cache',
					{
						'section': 'VARCHAR(255) NOT NULL',
						'data': 'MEDIUMTEXT'
					},
					['section']
				)
				.success(() =>
				{
					_serverManager.mysql.query(
							'SELECT section, data FROM cache'
						)
						.success((data) =>
						{
							for (let r = 0; r < data.result.length; r++)
							{
								_cache[data.result[r].section] = {
									altered: false,
									data: JSON.parse(data.result[r].data)
								};
							}

							console.log('ServerManager - MySql cache loaded');

							_starting.resolve($stateCache);
						})
						.fail((error) =>
						{
							console.log('ServerManager - Unabled to read MySql cache:');
							console.log(error);
							process.exit();
						});
				})
				.fail((error) =>
				{
					console.log('ServerManager - Failed to initialize MySql cache:');
					console.log(error);
					process.exit();
				});
		}
		else if ($fs.existsSync(_serverManager.config.cache.file))
		{
			_cache = JSON.parse($fs.readFileSync(_serverManager.config.cache.file, 'utf8'));
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
		let cacheFunction;

		if (_serverManager.config.cache.format === 'mongoose')
		{
			// TODO: mongoose
		}
		else if (_serverManager.config.cache.format === 'mysql')
		{
			cacheFunction = saveCacheToMySql;
		}
		else
		{
			cacheFunction = saveCacheToFile;
		}

		setInterval(
			cacheFunction,
			_serverManager.config.cache.interval
		);
	} // setCacheInterval()

	function saveCacheToMySql()
	{
		if (_app.saveCache)
		{
			_app.saveCache();
		}

		if (_altered)
		{
			let sql = ['REPLACE LOW_PRIORITY INTO cache VALUES ']
			let list = []

			for (let c in _cache)
			{
				list.push([
					'(\'',
					c,
					'\', ',
					_serverManager.mysql.encode(JSON.stringify(_cache[c].data)),
					')'
				].join(''));
			}

			sql.push(list.join(', '));

			_serverManager.mysql.query(sql.join(''))
				.fail((error) =>
				{
					console.log('ServerManager - Failed to save MySql cache:');
					console.log(error);
				});

				_altered = false;
		}
	} // function saveCacheToMySql()

	function saveCacheToFile()
	{
		if (_app.saveCache)
		{
			_app.saveCache();
		}

		if (_altered)
		{
			$fs.writeFile(
				_serverManager.config.cache.file,
				JSON.stringify(_cache),
				{ encoding: 'utf8' }
			);
			_altered = false;
		}
	} // function saveCacheToFile()
};