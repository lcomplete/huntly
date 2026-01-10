import MainContainer from "../../components/MainContainer";
import LibrarySetting from "../../components/SettingModal/LibrarySetting";

const SettingsLibrary = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <LibrarySetting />
      </div>
    </MainContainer>
  );
};

export default SettingsLibrary;

