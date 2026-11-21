import { useEffect, useRef, useState } from 'react';
import { FaCloudUploadAlt } from 'react-icons/fa';
import { useProfile } from '../../context/ProfileContext.jsx';

export default function FileUploader({ tool, onFiles }) {
  const input = useRef();
  const [drag, setDrag] = useState(false);
  const [profileFileName, setProfileFileName] = useState('');
  const { pendingToolFile, clearPendingToolFile } = useProfile();

  useEffect(() => {
    if (!pendingToolFile) return;
    onFiles([pendingToolFile]);
    setProfileFileName(pendingToolFile.name);
    clearPendingToolFile();
  }, [pendingToolFile, onFiles, clearPendingToolFile]);

  const add = (list) => { setProfileFileName(''); onFiles([...list]); };
  const selectFiles = (event) => { add(event.target.files); event.target.value = ''; };
  return <>
    {profileFileName && <p className="profile-file-loaded" role="status">Loaded from your profile: <strong>{profileFileName}</strong></p>}
    <div className={`uploader ${drag ? 'drag' : ''}`} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); add(event.dataTransfer.files); }}>
      <button className="uploader-select" type="button" onClick={() => input.current.click()}>
        <span className="uploader-icon" aria-hidden="true"><FaCloudUploadAlt/></span>
        <span className="btn btn-primary uploader-button-label">Select {tool.multiple ? 'files' : 'a file'}</span>
        <span className="uploader-hint">or drag and drop here</span>
        <small>{tool.accept}</small>
      </button>
      <input ref={input} hidden type="file" accept={tool.accept} multiple={tool.multiple} onChange={selectFiles}/>
    </div>
  </>;
}
