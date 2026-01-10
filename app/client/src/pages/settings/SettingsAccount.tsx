import MainContainer from "../../components/MainContainer";
import AccountSetting from "../../components/SettingModal/AccountSetting";

const SettingsAccount = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <AccountSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsAccount;

