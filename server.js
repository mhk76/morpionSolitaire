require('./serverManager.js')({
	"app": {
		"file": "./app/app.js",
		"watchModules": true
	},
	"web" : {
		"root": "./web/",
		"defaultFile": "client.html",
		"protocol": "http",
		"httpsKeyFile": null,
		"httpsCertFile": null,
		"postBlockLimit": 1e5,
		"webSockets": true,
		"disablePost": false
	},
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