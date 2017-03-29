Number.prototype.toPadded = function(length, padChar)
{
	var output = this.toString();

	if (output.length < length)
	{
		return (padChar || '0').toString().substr(0, 1).repeat(length - output.length) + output;
	}

	return output.slice(-length);
};
