import MainContainer from "../../components/MainContainer";
import GeneralSetting from "../../components/SettingModal/GeneralSetting";
import SubHeader from "../../components/SubHeader";
import SettingsIcon from '@mui/icons-material/Settings';
import "../../styles/settings.css";
import { useTranslation } from "react-i18next";

const SettingsGeneral = () => {
  const { t } = useTranslation('settings');

  return (
    <MainContainer>
      <SubHeader
        documentTitle={t('general')}
        navLabel={{ labelText: t('general'), labelIcon: SettingsIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <GeneralSetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsGeneral;


