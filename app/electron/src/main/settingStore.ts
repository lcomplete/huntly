import Store from "electron-store";

export default class SettingStore {
  store = new Store({
    schema: {
      serverPort: {
        type: 'number',
        maximum: 65535,
        minimum: 1,
        default: 8123
      },
      removeServerUrl: {
        type: 'string',
        format: 'uri'
      }
    }
  });

  getServerPort() {
    return this.store.get("serverPort");
  }

  setServerPort(port: number) {
    this.store.set("serverPort", port);
  }
}