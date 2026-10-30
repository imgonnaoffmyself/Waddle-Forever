import { ipcRenderer } from 'electron';
import { addDispatchEventListeners } from '@common/utils';

addDispatchEventListeners([
  'get-info'
], ipcRenderer);

(window as any).api = {
  update: (type: string | undefined, ip?: string, port?: number | string) => ipcRenderer.send('update', { ip, port, type })
};