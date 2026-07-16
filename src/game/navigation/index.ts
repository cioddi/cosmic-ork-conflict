import BuildingNavigationModel, {
  BuildingNavigationOptions,
} from "./BuildingNavigationModel";

let navigationPromise: Promise<BuildingNavigationModel> | null = null;
let navigationInstance: BuildingNavigationModel | null = null;

export function initializeNavigationModel(
  options: BuildingNavigationOptions
): Promise<BuildingNavigationModel> {
  if (!navigationPromise) {
    navigationPromise = BuildingNavigationModel.build(options)
      .then((instance) => {
        navigationInstance = instance;
        return instance;
      })
      .catch((error) => {
        navigationPromise = null;
        throw error;
      });
  }
  return navigationPromise;
}

export function getNavigationModel(): BuildingNavigationModel | null {
  return navigationInstance;
}

