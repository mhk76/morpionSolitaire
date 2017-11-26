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
	"mysql": {
		"host": "localhost",
		"user": "",
		"password": "",
		"database": "morpion_solitaire"
	},
	"log": {
		"format": "mysql",
		"path": "./log/"
	},
	"cache": {
		"format": "mysql",
		"file": "./cache.json",
		"interval": 60
	}
});