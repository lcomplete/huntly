import MainContainer from "../../components/MainContainer";
import GeneralSetting from "../../components/SettingModal/GeneralSetting";

const SettingsGeneral = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <GeneralSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsGeneral;

