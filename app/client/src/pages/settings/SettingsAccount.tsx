import MainContainer from "../../components/MainContainer";
import AccountSetting from "../../components/SettingModal/AccountSetting";
import SubHeader from "../../components/SubHeader";
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import "../../styles/settings.css";

const SettingsAccount = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{ labelText: 'Account', labelIcon: AccountBoxIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <AccountSetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsAccount;


