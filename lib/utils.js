import pc from 'picocolors'

export function info (msg, ...args) {
	if (args.length > 0) {
		console.log(msg, args)
	} else {
		console.log(msg)
	}
}

export function section (msg) {
	console.log(pc.bold(`-- ${msg} --`))
}

export function warn (msg, ...args) {
	msg = pc.yellow(msg)
	if (args.length > 0) {
		console.log(msg, args)
	} else {
		console.log(msg)
	}
}

export function error (msg, ...args) {
	msg = pc.red(msg)
	if (args.length > 0) {
		console.log(msg, args)
	} else {
		console.log(msg)
	}
}
