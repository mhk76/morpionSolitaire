var ws = require('ws');

module.exports = function(serverManager)
{
	var _webSockets = {};
	var _modeListeners = {};
	var _defaultListener = function (request)
		{
			console.log('defaultListener', request);
			request.response({
				status: 'default'
			});
		};

	(new ws.Server({ server: serverManager.webServer }))
		.on('connection', function(webSocket)
		{
			webSocket
				.on('message', function(message)
				{
					var startTime = new Date().getTime();
					var request;
					
					try
					{
						var json = JSON.parse(message);

						request = {
							requestId: json.requestId,
							userId: json.userId,
							action: json.action,
							mode: json.mode,
							data: json.data,
							connection: {
								remoteAddress: webSocket && webSocket._socket && webSocket._socket.remoteAddress
							},
							response: function(data, status)
							{
								webSocket.send(JSON.stringify({
									requestId: request.requestId,									
									userId: request.userId,
									permanentTracking: serverManager.config.permanentTracking || false,
									status: status || 'ok',
									data: data
								}));
							},
							terminate: function()
							{
								serverManager.writeLog('ws', 'terminate-force', request, startTime, err);
								webSocket.terminate();
							}
						};
					}
					catch (err)
					{
						serverManager.writeLog('ws', 'error', request, startTime, err);
						webSocket.terminate();
						return;
					}

					if (!request.requestId)
					{
						serverManager.writeLog('ws', 'missing-requestId', request, startTime, err);
						webSocket.terminate();
						return;
					}
					if (!request.action)
					{
						serverManager.writeLog('ws', 'missing-action', request, startTime, err);
						webSocket.terminate();
						return;
					}
					if (!request.userId)
					{
						if (webSocket.userId && webSocket.userId != request.userId)
						{
							serverManager.writeLog('ws', 'invalid-userId', request, startTime, err);
							webSocket.terminate();
							return;
						}
						request.userId = Math.random().toString().substr(2) + Math.random().toString().substr(1); 
					}
					
					webSocket.userId = request.userId;

					if (_webSockets[webSocket.userId])
					{
						serverManager.writeLog('ws', 'terminate-old', request, startTime, err);
						_webSockets[webSocket.userId].terminate();
					}

					_webSockets[webSocket.userId] = {
						target: null,
						webSocket: webSocket
					};

					if (request.mode)
					{
						if (!_modeListeners[request.mode])
						{
							serverManager.writeLog('ws', 'invalid-mode', request, startTime, err);
							webSocket.terminate();
							return;
						}
						
						_modeListeners[request.mode](request);
					}
					else
					{
						_defaultListener(request);
					}
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
		setDefaultListener: function(callback)
		{
			_defaultListener = callback;
		},
		addModeListener: function(mode, callback)
		{
			_modeListeners[mode] = callback;
		},
		setUserTarget: function(userId, target)
		{
			_webSockets[userId].target = target;
		},
		push: function(target, dataType, data)
		{
			for (var userId in _webSockets)
			{
				if (_webSockets[userId] && _webSockets[userId].target === target)
				{
					_webSockets[userId].send(JSON.stringify({
						requestId: dataType,
						userId: userId,
						permanentTracking: serverManager.config.permanentTracking || false,
						status: 'broadcast',
						data: data
					}));
				}
			}
		}
	};
};
