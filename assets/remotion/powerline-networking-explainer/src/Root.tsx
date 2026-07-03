import "./index.css";
import { Composition } from "remotion";
import { PowerlineExplainer } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PowerlineExplainer"
        component={PowerlineExplainer}
        durationInFrames={640}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
