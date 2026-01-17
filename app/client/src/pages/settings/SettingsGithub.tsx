import MainContainer from "../../components/MainContainer";
import {GithubSetting} from "../../components/SettingModal/GithubSetting";
import SubHeader from "../../components/SubHeader";
import GitHubIcon from '@mui/icons-material/GitHub';

const SettingsGithub = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{labelText: 'GitHub', labelIcon: GitHubIcon}}
        buttonOptions={{markRead: false}}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <GithubSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsGithub;

