import MainContainer from "../../components/MainContainer";
import GeneralSetting from "../../components/SettingModal/GeneralSetting";
import SubHeader from "../../components/SubHeader";
import SettingsIcon from '@mui/icons-material/Settings';

const SettingsGeneral = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{labelText: 'General', labelIcon: SettingsIcon}}
        buttonOptions={{markRead: false}}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <GeneralSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsGeneral;

