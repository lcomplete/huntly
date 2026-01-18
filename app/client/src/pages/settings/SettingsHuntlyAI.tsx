import MainContainer from "../../components/MainContainer";
import HuntlyAISetting from "../../components/SettingModal/HuntlyAISetting";
import SubHeader from "../../components/SubHeader";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import "../../styles/settings.css";

const SettingsHuntlyAI = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{ labelText: 'Huntly AI', labelIcon: AutoAwesomeIcon }}
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


