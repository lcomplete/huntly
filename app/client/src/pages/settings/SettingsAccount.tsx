import MainContainer from "../../components/MainContainer";
import AccountSetting from "../../components/SettingModal/AccountSetting";
import SubHeader from "../../components/SubHeader";
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import "../../styles/settings.css";
import { useTranslation } from "react-i18next";

const SettingsAccount = () => {
  const { t } = useTranslation('settings');

  return (
    <MainContainer>
      <SubHeader
        documentTitle={t('account')}
        navLabel={{ labelText: t('account'), labelIcon: AccountBoxIcon }}
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


