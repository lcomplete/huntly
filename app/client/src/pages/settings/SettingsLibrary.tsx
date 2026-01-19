import MainContainer from "../../components/MainContainer";
import LibrarySetting from "../../components/SettingModal/LibrarySetting";
import SubHeader from "../../components/SubHeader";
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import "../../styles/settings.css";

const SettingsLibrary = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{ labelText: 'Library', labelIcon: LibraryBooksIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <LibrarySetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsLibrary;


