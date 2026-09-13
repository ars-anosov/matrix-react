import {
  HowToReg as IconHowToReg,
  PersonOff as IconPersonOff,
  VerifiedUser as IconVerifiedUser,
} from "@mui/icons-material";
import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import MtrxDeviceVerification from "./MtrxDeviceVerification";

function MtrxInfo(props) {
  const { mtrxControlRdcr, mtrxControlActions, showFull = false } = props;

  if (import.meta.env.DEV) {
    console.log("MtrxInfo render");
  }

  const verification = mtrxControlRdcr?.deviceVerification || {};
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) console.log("MtrxInfo MOUNT");
    mtrxControlActions?.handleLoadDeviceVerification?.();
    return () => {
      if (import.meta.env.DEV) console.log("MtrxInfo UNMOUNT");
    };
  }, [mtrxControlActions]);

  const toggleAuth = () => {
    mtrxControlActions?.handleChangeStore("displayReg", !mtrxControlRdcr?.displayReg);
  };

  const isAuthorized = mtrxControlRdcr?.status === "success";
  const isDeviceVerified = verification.status === "success" && verification.verified === true;
  const authButtonColor = isAuthorized ? "success" : "error";

  return (
    <Paper
      elevation={showFull ? 8 : 0}
      sx={{
        maxWidth: 320,
        width: "100%",
        mx: "auto",
        mt: 2,
        p: showFull ? 1 : 0,
        borderRadius: 3,
        position: "relative",
      }}
    >
      <Typography
        variant="body2"
        component="pre"
        sx={{
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {`display_name:\t${mtrxControlRdcr?.responseData?.display_name || ""}
user_id:\t\t${mtrxControlRdcr?.responseData?.user_id || ""}
device_id:\t${mtrxControlRdcr?.responseData?.device_id || ""}`}
      </Typography>

      {mtrxControlRdcr?.status === "error" && mtrxControlRdcr?.errText && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {mtrxControlRdcr.errText}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "space-between", alignItems: "center" }}>
        <Tooltip title={isAuthorized ? "Деавторизоваться" : "Авторизоваться"}>
          <IconButton color={authButtonColor} onClick={toggleAuth}>
            {isAuthorized ? <IconHowToReg /> : <IconPersonOff />}
          </IconButton>
        </Tooltip>
        {isAuthorized && (
          <Tooltip title={isDeviceVerified ? "Устройство авторизовано" : "Устройство не авторизовано для E2EE"}>
            <IconButton
              aria-label="Проверка устройства"
              color={isDeviceVerified ? "success" : "error"}
              onClick={() => setIsVerificationOpen(true)}
            >
              <IconVerifiedUser />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <MtrxDeviceVerification
        open={isVerificationOpen}
        verification={verification}
        mtrxControlActions={mtrxControlActions}
        onClose={() => setIsVerificationOpen(false)}
      />
    </Paper>
  );
}

MtrxInfo.propTypes = {
  mtrxControlRdcr: PropTypes.object.isRequired,
  mtrxControlActions: PropTypes.object.isRequired,
  showFull: PropTypes.bool,
};

export default MtrxInfo;
