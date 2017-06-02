var ws = require('ws');

module.exports = function(serverManager)
{
	var _webSockets = {};
	var _listener = function (request)
		{
			console.log('default webSocket listener', request);
			request.response({
				status: 'ok'
			});
		};

	(new ws.Server({ server: serverManager.webServer }))
		.on('connection', function(webSocket)
		{
			webSocket
				.on('message', function(message)
				{
					var startTime = new Date().getTime();
					var appRequest;
					
					try
					{
						var json = JSON.parse(message);
						var buffer = {};

						appRequest = {
							requestId: json.requestId,
							userId: json.userId,
							action: json.action,
							inputDataLength: message.length,
							parameters: json.parameters,
							connection:
							{
								remoteAddress: webSocket && webSocket._socket && webSocket._socket.remoteAddress
							},
							buffer: function(action, parameters, response, isPermanent)
							{
								buffer[action] = {
									parameters: parameters || {},
									response: response || {},
									isPermanent: isPermanent ||false
								};
							},
							response: function(data, status)
							{
								var outputData = JSON.stringify({
									requestId: appRequest.requestId,									
									userId: appRequest.userId,
									userTracking: serverManager.config.web.userTracking,
									status: status || 'ok',
									data: data || 'ok',
									buffer: buffer
								});

								appRequest.outputDataLength = outputData.length;

								serverManager.writeLog('ws', 'response', appRequest, startTime);
								webSocket.send(outputData);
							},
							terminate: function()
							{
								serverManager.writeLog('ws', 'terminate-force', appRequest, startTime);
								webSocket.terminate();
							}
						};
					}
					catch (err)
					{
						serverManager.writeLog('ws', 'error', appRequest, startTime, err);
						webSocket.terminate();
						return;
					}

					if (!appRequest.requestId)
					{
						serverManager.writeLog('ws', 'missing-requestId', appRequest, startTime, err);
						webSocket.terminate();
						return;
					}
					if (!appRequest.action)
					{
						serverManager.writeLog('ws', 'missing-action', appRequest, startTime, err);
						webSocket.terminate();
						return;
					}
					if (!appRequest.userId)
					{
						if (webSocket.userId && webSocket.userId != appRequest.userId)
						{
							serverManager.writeLog('ws', 'invalid-userId', appRequest, startTime, err);
							webSocket.terminate();
							return;
						}
						appRequest.userId = Math.random().toString().substr(2) + Math.random().toString().substr(1); 
					}
					
					webSocket.userId = appRequest.userId;

					if (_webSockets[webSocket.userId])
					{
						serverManager.writeLog('ws', 'terminate-old', appRequest, startTime, err);
						_webSockets[webSocket.userId].terminate();
					}

					_webSockets[webSocket.userId] = {
						target: null,
						webSocket: webSocket
					};

					setTimeout(function()
					{
						_listener(appRequest);
					});
				})
				.on('close', function()
				{
					if (webSocket.userId)
					{
						_webSockets[webSocket.userId] = null;
					}
				});
		});

	console.log('WebSocket - attached to WebServer');	

	return {
		setListener: function(callback)
		{
			_listener = callback;
		},
		setUserTarget: function(userId, target)
		{
			_webSockets[userId].target = target;
		},
		broadcast: function(target, dataType, data)
		{
			for (var userId in _webSockets)
			{
				if (_webSockets[userId] && _webSockets[userId].target === target)
				{
					_webSockets[userId].send(JSON.stringify({
						requestId: dataType,
						userId: userId,
						userTracking: serverManager.config.web.userTracking,
						status: 'broadcast',
						data: data
					}));
				}
			}
		}
	};
};
