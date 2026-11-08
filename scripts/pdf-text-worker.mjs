// One PDF's text, read in a thread of its own (scripts/ratings-probe.mjs, pdfTextLimited), so a PDF too big for memory
// stops only this thread, not the run that asked for it.
import {parentPort,workerData} from 'node:worker_threads';
import {pdfText} from '../src/pdf.mjs';
parentPort.postMessage(await pdfText(workerData));
