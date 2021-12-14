/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from 'vs/base/common/async';
import { Disposable } from 'vs/base/common/lifecycle';
import { isWindows } from 'vs/base/common/platform';
import { ITerminalChildProcess } from 'vs/platform/terminal/common/terminal';

/**
 * Tracks a terminal process's data stream and responds immediately when a matching string is
 * received. This is done in a low overhead way and is ideally run on the same process as the
 * where the process is handled to minimize latency.
 */
export class TerminalAutoResponder extends Disposable {
	private _pointer = 0;
	private _paused = false;

	/**
	 * Each reply is throttled by a second to avoid resource starvation and responding to screen
	 * reprints on Winodws.
	 */
	private _throttled = false;

	constructor(
		proc: ITerminalChildProcess,
		matchWord: string,
		response: string
	) {
		super();

		this._register(proc.onProcessData(e => {
			if (this._paused || this._throttled) {
				return;
			}
			const data = typeof e === 'string' ? e : e.data;
			console.log('data ' + data);
			for (let i = 0; i < data.length; i++) {
				if (data[i] === matchWord[this._pointer]) {
					this._pointer++;
				} else {
					this._reset();
				}
				// Auto reply and reset
				if (this._pointer === matchWord.length) {
					proc.input(response);
					this._throttled = true;
					timeout(1000).then(() => this._throttled = false);
					this._reset();
				}
			}
		}));
	}

	private _reset() {
		this._pointer = 0;
	}

	/**
	 * No auto response will happen after a resize on Windows in case the resize is a result of
	 * reprinting the screen.
	 */
	handleResize() {
		if (isWindows) {
			this._paused = true;
		}
	}

	handleInput() {
		this._paused = false;
	}
}
