export function showErrorDialog(message: string): void {
  document.dispatchEvent(
    new CustomEvent<string>("error-dialog:show", { detail: message }),
  );
}
