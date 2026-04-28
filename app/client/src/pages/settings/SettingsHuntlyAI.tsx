import MainContainer from "../../components/MainContainer";
import HuntlyAISetting from "../../components/SettingModal/HuntlyAISetting";
import SubHeader from "../../components/SubHeader";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import "../../styles/settings.css";
import { useTranslation } from "react-i18next";

const SettingsHuntlyAI = () => {
  const { t } = useTranslation('settings');

  return (
    <MainContainer>
      <SubHeader
        documentTitle={t('huntlyAI')}
        navLabel={{ labelText: t('huntlyAI'), labelIcon: AutoAwesomeIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <HuntlyAISetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsHuntlyAI;


