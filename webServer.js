var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

const _mime = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.json': 'text/json',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.gif': 'image/gif'
};

module.exports = function(serverManager)
{
	var server;
	var port;
	var _listener = function (request)
		{
			console.log('default POST listener', request);
			return {
				status: 'ok'
			}
		};

	if (serverManager.config.web.protocol === 'https')
	{
		server = https.createServer(
			{
				key: fs.readFileSync(serverManager.config.web.httpsKeyFile),
				cert: fs.readFileSync(serverManager.config.web.httpsCertFile)
			},
			HttpListener
		);
		port = process.env.port || serverManager.config.web.port || 443;
	}
	else
	{
		server = http.createServer(HttpListener);
		port = process.env.port || serverManager.config.web.port || 80;
	}

	server.listen(
		port,
		function()
		{
			serverManager.writeLog(serverManager.config.web.protocol, 'starting');
			console.log('WebServer - listening to port ' + port);
		}
	);

	server.setListener = function(callback)
	{
		_listener = callback;
	};

	return server;

	function HttpListener(request, response, head)
	{
		var startTime = new Date().getTime();

		try
		{
			if (request.method === 'GET')
			{
				try
				{
					var url = path.parse(request.url);
					var file = serverManager.config.web.root + url.dir.appendTrail('/') + (url.base || serverManager.config.web.defaultFile);

					fs.access(file, fs.R_OK, function(err)
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
							{ 'Content-type': _mime[url.ext || '.html'] || 'application/octet-stream' }
						);

						fs.createReadStream(file).pipe(response);

						serverManager.writeLog(serverManager.config.web.protocol, 200, request, startTime);
					});
				}
				catch (err)
				{
					serverManager.writeLog(serverManager.config.web.protocol, 404, request, startTime, err);
					response.writeHead(404);
					response.end();
				}
			}
			else if (request.method === 'POST' && !serverManager.config.web.disablePost)
			{
				var queryData = [];

				request.on(
					'data',
					function (data)
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
					var json = JSON.stringify(queryData.join(''));
					var buffer = {};
					var appRequest = {
						userId: json.userId,
						action: json.action,
						parameters: json.parameters,
						inputDataLength: queryData.length,
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
							var outputData = JSON.stringify({
								userId: request.userId,
								userTracking: serverManager.config.web.userTracking,
								status: status || 'ok',
								data: data || {},
								buffer: buffer
							});

							response.write(outputData);
							appRequest.outputDataLength = outputData.length;

							serverManager.writeLog(serverManager.config.web.protocol, 200, appRequest, startTime);
							response.writeHead(200, { 'Content-Type': 'text/json' });
							response.end();
						},
						terminate: function()
						{							
							serverManager.writeLog(serverManager.config.web.protocol, 400, appRequest, startTime);
							response.writeHead(400);
							response.end();
						}
					};

					setTimeout(function()
					{
						_listener(appRequest);
					});
				});
			}
			else
			{
				serverManager.writeLog(serverManager.config.web.protocol, 405, request, startTime);
				response.writeHead(405);
				response.end();
			}
		}
		catch (err)
		{
			serverManager.writeLog(serverManager.config.web.protocol, 500, request, startTime, err);
			response.writeHead(500);
			response.end();
		}
	};
};