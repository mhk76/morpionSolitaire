require('./serverManager.js')({
	"web" : {
		"root": "./web/",
		"defaultFile": "client.html",
		"protocol": "http",
		"port": 8080,
		"httpsKeyFile": null,
		"httpsCertFile": null,
		"postBlockLimit": 1e5
	},
	"webSockets": true,
	"permanentTracking": false,
	"appFile": "./app/app.js",
	"log": {
		"format": "file",
		"path": "./log/"
	},
	"cache": {
		"format": "file",
		"file": "./cache.json",
		"interval": 60
	}
});