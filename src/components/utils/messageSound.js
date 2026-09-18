// Звук нового сообщения. Файл — Material sound resources (© Google, CC-BY 4.0),
// взят из Cinny: public/sound/notification.ogg, см. README → Лицензия.
//
// Путь относительный, как у иконки в index.html: сборка идёт с base: "./",
// поэтому абсолютный /sounds/... на подкаталоге выкладки (ars-dev.ru/matrix-react/)
// тоже нужен относительный адрес.
const MESSAGE_SOUND_URL = "sounds/message.ogg";

let audioElement = null;

// Элемент создаём лениво и один: до первого сообщения он не нужен, а повторные
// `new Audio` плодили бы параллельные загрузки файла.
function getAudioElement() {
  if (audioElement) return audioElement;
  if (typeof Audio === "undefined") return null;

  audioElement = new Audio(MESSAGE_SOUND_URL);
  audioElement.preload = "auto";
  return audioElement;
}

/**
 * Проигрывает звук сообщения с начала: быстро пришедшие подряд сообщения не
 * должны «съедать» друг друга.
 *
 * Браузер может отклонить воспроизведение до первого действия пользователя
 * (autoplay policy) — для UI это не ошибка, поэтому промис глушим.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
 */
function playMessageSound() {
  const element = getAudioElement();
  if (!element) return;

  element.currentTime = 0;
  element.play()?.catch(() => {});
}

// Прогреваем файл заранее (после входа): элемент создаётся лениво, а первое
// сообщение не должно ждать загрузки — иначе звук запаздывает или пропадает.
function preloadMessageSound() {
  getAudioElement();
}

export { playMessageSound, preloadMessageSound };
