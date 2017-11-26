const $http = require('http');
const $https = require('https');
const $fs = require('fs');
const $path = require('path');

const Promise = require('./promise.js');

const $mime = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.json': 'application/json',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.gif': 'image/gif'
};

module.exports = function(serverManager)
{
	let _server;
	let _port;
	let _listener = function(request)
		{
			console.log('default POST listener', request);
			request.response({}, 'ok');
		};

	if (serverManager.config.web.protocol === 'https')
	{
		_server = $https.createServer(
			{
				key: $fs.readFileSync(serverManager.config.web.httpsKeyFile),
				cert: $fs.readFileSync(serverManager.config.web.httpsCertFile)
			},
			HttpListener
		);
		_port = process.env.PORT || serverManager.config.web.port || 443;
	}
	else
	{
		_server = $http.createServer(HttpListener);
		_port = process.env.PORT || serverManager.config.web.port || 80;
	}

	_server.loading = Promise();

	_server.listen(
		_port,
		function()
		{
			serverManager.writeLog(serverManager.config.web.protocol, 'starting');
			_server.loading.resolve();
			console.log('WebServer - listening to port ' + _port);
		}
	);

	_server.setListener = function(callback)
	{
		_listener = callback;
	};

	return _server;

	function HttpListener(request, response, head)
	{
		let startTime = new Date().getTime();

		try
		{
			if (request.method === 'GET')
			{
				try
				{
					let url = $path.parse(request.url);
					let file =
						serverManager.config.web.root
						+ url.dir.appendTrail('/')
						+ (url.base || serverManager.config.web.defaultFile);

					$fs.access(file, $fs.R_OK, function(err)
					{
						if (err)
						{
							serverManager.writeLog(serverManager.config.web.protocol, 404, request, startTime, err);
							response.writeHead(404);
							response.end();
							return;
						}

						response.writeHead(
							200,
							{ 'Content-type': $mime[url.ext || '.html'] || 'application/octet-stream' }
						);

						$fs.createReadStream(file).pipe(response);

						serverManager.writeLog(serverManager.config.web.protocol, 200, request, startTime);
					});
				}
				catch (err)
				{
					serverManager.writeLog(serverManager.config.web.protocol, 404, request, startTime, err);
					response.writeHead(404);
					response.end();
				}
				return;
			}
			
			if (request.method === 'POST' && !serverManager.config.web.disablePost)
			{
				let queryData = [];

				request.on(
					'data',
					function(data)
					{
						queryData.push(data);
						if (queryData.length > serverManager.config.web.postBlockLimit)
						{
							queryData = "";
							serverManager.writeLog(serverManager.config.web.protocol, 404, request, startTime, err);
							response.writeHead(413);
							response.end();
							request.connection.destroy();
						}
					}
				);

				request.on('end', function() {
					let inputData = queryData.join('');
					let json = JSON.parse(inputData);
					let buffer = {};
					let appRequest = {
						userId: json.userId,
						action: json.action,
						parameters: json.parameters,
						inputDataLength: inputData.length,
						connection:
						{
							remoteAddress: request.connection.remoteAddress
						},
						buffer: function(action, parameters, response, isPermanent)
						{
							buffer[action] = {
								parameters: parameters || {},
								response: response || {},
								isPermanent: isPermanent || false
							};
						},
						response: function(data, status)
						{
							let outputData = JSON.stringify({
								userId: request.userId,
								status: status || 'ok',
								data: data || {}
							});

							if (Object.keys(buffer).length > 0)
							{
								outputData['buffer'] = buffer;
							}

							appRequest.outputDataLength = outputData.length;

							response.writeHead(200, { 'Content-Type': 'application/json' });
							response.write(outputData);
							response.end();

							serverManager.writeLog(serverManager.config.web.protocol, 200, appRequest, startTime);
						},
						terminate: function()
						{							
							response.writeHead(400);
							response.end();

							serverManager.writeLog(serverManager.config.web.protocol, 400, appRequest, startTime);
						}
					};

					setTimeout(function()
					{
						_listener(appRequest);
					});
				});

				return;
			}

			serverManager.writeLog(serverManager.config.web.protocol, 405, request, startTime);
			response.writeHead(405);
			response.end();
		}
		catch (err)
		{
			serverManager.writeLog(serverManager.config.web.protocol, 500, request, startTime, err);
			response.writeHead(500);
			response.end();
		}
	};
};