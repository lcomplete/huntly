import MainContainer from "../../components/MainContainer";
import { GithubSetting } from "../../components/SettingModal/GithubSetting";
import SubHeader from "../../components/SubHeader";
import GitHubIcon from '@mui/icons-material/GitHub';
import "../../styles/settings.css";
import { useTranslation } from "react-i18next";

const SettingsGithub = () => {
  const { t } = useTranslation('settings');

  return (
    <MainContainer>
      <SubHeader
        documentTitle={t('github')}
        navLabel={{ labelText: t('github'), labelIcon: GitHubIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <GithubSetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsGithub;


