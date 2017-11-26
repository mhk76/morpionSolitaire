module.exports = function()
{
	let promise = {
		resolved: false,
		failed: false,
		then: function(successCallback, failCallback) {
			promise.successCallback = successCallback;
			promise.failCallback = failCallback;

			if (promise.failed)
			{
				failCallback(promise.error);
				return promise;
			}
			if (promise.resolved)
			{
				successCallback(promise.result);
			}

			return promise;
		},
		success: function(callback) {
			promise.successCallback = callback;

			if (promise.failed)
			{
				return promise;
			}
			if (promise.resolved)
			{
				callback(promise.result);
			}

			return promise;
		},
		fail: function(callback) {
			promise.failCallback = callback;

			if (promise.failed)
			{
				callback(promise.error);
			}

			return promise;
		},
		resolve: function(data)
		{
			promise.resolved = true;
			promise.failed = false;
			promise.result = data;
			delete promise.error;

			if (promise.successCallback)
			{
				promise.successCallback(data);
			}
		},
		reject: function(error)
		{
			promise.resolved = false;
			promise.failed = true;
			delete promise.result;
			promise.error = error;

			if (promise.failCallback)
			{
				promise.failCallback(error);
			}
		}
	};

	return promise;
};
