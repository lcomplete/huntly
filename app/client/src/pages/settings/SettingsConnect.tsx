import MainContainer from "../../components/MainContainer";
import { ConnectorSetting } from "../../components/SettingModal/ConnectorSetting";

const SettingsConnect = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <ConnectorSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsConnect;

