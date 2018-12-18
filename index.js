#!/usr/bin/env node
let Readline = require("readline")
let execa = require("execa")
let path = require("path")
let fs = require("fs-extra")
require("colors")

let ask = question => {
	let reader = Readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})

	return new Promise(good =>
		reader.question(question, answer => {
			good(answer)
			reader.close()
		})
	)
}

let dependencies = [
	"canvas-sketch",
	"canvas-sketch-util"
]

let fileCreators = {
	"get-canvas.js"() {
		return `// NOTE: You shouldn't need to edit this file it's only to deal
// with anomalies of canvas-sketch and parcel together when
// they are working together as a team

let createCanvas = () => {
	let canvas = document.createElement("canvas")
	canvas.id = "canvas"
	return canvas
}

export default () =>
	document.getElementById("canvas") || createCanvas()
`
	},

	"sketch.js"() {
		return `import canvasSketch from "canvas-sketch"
import getCanvas from "./get-canvas.js"

let canvas = getCanvas()

let settings = {
	dimensions: [
		2048,
		2048
	],
	canvas
}

let sketch = () => ({context, width, height}) => {
	let margin = 400
	context.fillStyle = "hsl(5, 37%, 94%)"
	context.fillRect(0, 0, width, height)

	let gradient = context.createLinearGradient(
		7,
		30,
		95,
		height / 1.75
	)
	gradient.addColorStop(0, "hsl(220, 100%, 90%)")
	gradient.addColorStop(1, "hsl(340, 100%, 50%)")
	context.fillStyle = gradient
	context.fillRect(
		margin,
		margin,
		width - margin * 2,
		height - margin * 2,
	)
}

canvasSketch(sketch, settings)

document.body.append(settings.canvas)
`
	},

	"index.html"({ name }) {
		return `<!doctype html>
<title>${name}</title>
<style>
	body {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
	}

	canvas {
		border: 1px solid pink;
		box-shadow: 0 0 4px rgba(250, 240, 15, 0.5);
	}
</style>
<body>
<script src="./sketch.js"></script>
`
	}
}

let npm = function npm(...args) {
	console.log(`running "npm ${args.join(" ")}"`.blue.bold)
	return execa("npm", [...args])
}

npm.install = function npmInstall(...dependencies) {
	return this(
		"install",
		...dependencies
	)
}

npm.devInstall = function npmInstall(...dependencies) {
	return this.install(
		"-D",
		...dependencies
	)
}

void async function () {
	let name = await ask("What is this sketch's name? ".cyan)
	let currentDirectory = process.cwd()
	let workingDirectory = path.resolve(
		currentDirectory,
		name
	)

	console.log(`making directory ${workingDirectory}`.blue)
	await fs.mkdirp(workingDirectory)
	console.log(`entering ${workingDirectory}`.blue)
	process.chdir(workingDirectory)
	await npm("init", "-y")
	await npm.install("canvas-sketch", "canvas-sketch-util")

	let manifestFile = path.resolve(workingDirectory, "package.json")
	let manifest = await fs.readJson(manifestFile)

	manifest.scripts = {
		build: "parcel build index.html -d ${SNOOT_OUTPUT_DIRECTORY:-website} --public-url ${SNOOT_PUBLIC_URL:-/}",
		watch: "parcel watch index.html -d ${SNOOT_OUTPUT_DIRECTORY:-website} --public-url ${SNOOT_PUBLIC_URL:-/}",
		start: "parcel index.html"
	}

	manifest.main = "index.html"

	console.log(`writing scripts and main to ${manifestFile}`.blue)
	await fs.outputJson(manifestFile, manifest, {spaces: "\t"})

	for (let filename in fileCreators) {
		let filepath = path.resolve(workingDirectory, filename)
		console.log(`writing to ${filepath}`.blue)
		await fs.outputFile(
			filepath,
			fileCreators[filename]({name})
		)
	}

	console.log(`

Created canvas sketch in: ${workingDirectory}

We expect ${"parcel".yellow} to be installed globally.
If this is not the case, you can install it in the project with:
$ ${"npm install -D parcel-bundler".yellow}

$ ${"npm start -- --open".green}

your code goes in ${"sketch.js".green}

${"<3".red.bold}`)
}()
