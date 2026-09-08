import { sharedStore } from '../lib/shared-store.js';
import { createExportHandler } from '../lib/trip-export.js';

export default createExportHandler(sharedStore);
