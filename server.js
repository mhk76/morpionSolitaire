require('servermanager')({
	"app": {
		"file": "./app.js",
		"database": "mysql"
	},
	"web": {
		"root": "./web/",
		"defaultFile": "client.html",
		"protocol": "http",
		"port": 8000,
		"webSockets": false
	},
	"mysql": {
		"host": "localhost",
		"user": "user",
		"password": "",
		"database": "morpion_solitaire"
	},
	"mongoose": "mongodb://localhost/morpionSolitaire",
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