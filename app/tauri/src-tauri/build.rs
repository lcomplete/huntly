extern crate embed_resource;

fn main() {
  tauri_build::build();
  // embed_resource::compile("huntly-manifest.rc", embed_resource::NONE);
}
