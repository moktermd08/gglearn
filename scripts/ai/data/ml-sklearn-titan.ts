import type { Card, QA, TrackSpec } from "../types";

type T = 1 | 2 | 3 | 4 | 5;
const c = (group: string, subject: string, tier: T, says: string[], use?: string, not?: string[], like?: string[]): Card => ({
  group, subject, tier, says, ...(use ? { use } : {}), ...(not ? { not } : {}), ...(like ? { like } : {}),
});
const q = (tier: T, qq: string, right: string, wrong: [string, string, string], why: string, code?: string, topic?: string): QA => ({
  q: qq, right, wrong, tier, why, ...(code ? { code } : {}), ...(topic ? { topic } : {}),
});

const cards: Card[] = [
  // ---- paradigms and tasks
  c("task", "supervised learning", 1, ["learns a mapping from inputs to known labeled outputs", "needs a dataset where each example has a target value", "covers both classification and regression"], "have historical examples with the correct answer attached", ["finds structure in data that has no labels"], ["unsupervised learning"]),
  c("task", "unsupervised learning", 1, ["finds structure in data without any target labels", "includes clustering and dimensionality reduction", "has no ground-truth answer to compute accuracy against"], "have a pile of unlabeled customer records and want natural groups", ["needs a labeled target column"], ["supervised learning"]),
  c("task", "reinforcement learning", 2, ["trains an agent by rewards for actions in an environment", "balances exploring new actions with exploiting known good ones", "learns a policy rather than a fixed input-output mapping"], "an agent must learn a sequence of decisions from reward signals", ["learns from a fixed table of labeled examples"]),
  c("task", "semi-supervised learning", 3, ["combines a small labeled set with a large unlabeled set", "uses the unlabeled data to improve the decision boundary"], "labeling is expensive and only a few examples are labeled", undefined, ["supervised learning"]),
  c("task", "classification", 1, ["predicts a discrete category", "can output class probabilities", "is evaluated with metrics such as precision and recall"], "predict whether an email is spam", ["predicts a continuous number"], ["regression"]),
  c("task", "regression", 1, ["predicts a continuous numeric value", "is commonly evaluated with RMSE or MAE"], "predict the number of units that will be sold", ["predicts one of a fixed set of categories"], ["classification"]),
  c("task", "clustering", 2, ["groups similar examples without labels", "needs a notion of distance or density to decide similarity"], "segment customers into groups without predefined labels", undefined, ["dimensionality reduction"]),
  c("task", "dimensionality reduction", 2, ["reduces the number of features while keeping most information", "helps visualisation and speeds up later models"], "have hundreds of correlated features and want a compact representation", undefined, ["clustering"]),
  c("task", "anomaly detection", 3, ["flags examples that differ strongly from the rest", "often works with few or no labeled outliers"], "look for unusual transactions with very few labeled fraud cases"),

  // ---- evaluation concepts
  c("evalc", "the training set", 1, ["is the data used to fit the model's parameters"], undefined, ["is the data used for the final unbiased performance estimate"], ["the validation set", "the test set"]),
  c("evalc", "the validation set", 2, ["is used to compare models and tune hyperparameters", "stands in for unseen data during development"], "need data to choose between settings without touching the final test data", ["is used to fit the model's weights"], ["the test set", "the training set"]),
  c("evalc", "the test set", 1, ["gives the final estimate of performance on unseen data", "should be used only once at the end", "becomes optimistic if used repeatedly to pick models"], "report how the finished model is expected to perform", ["may be used freely to tune hyperparameters"], ["the validation set"]),
  c("evalc", "overfitting", 1, ["means a model fits training noise and generalises poorly", "shows as high training score but much lower validation score", "is more likely with complex models and small datasets"], "training accuracy is 99 percent but validation accuracy is 70 percent", ["means both training and validation scores are low"], ["underfitting"]),
  c("evalc", "underfitting", 1, ["means a model is too simple to capture the pattern", "shows as poor scores on both training and validation data"], "both training and validation error are high", ["means training error is low but validation error is high"], ["overfitting"]),
  c("evalc", "the bias-variance tradeoff", 2, ["balances errors from overly simple models against errors from overly flexible ones", "has high bias for underfit models and high variance for overfit models"], "choosing between a shallow and a very deep tree"),
  c("evalc", "k-fold cross-validation", 2, ["splits data into k parts and uses each as validation once", "averages the k scores for a steadier estimate", "trains k separate models"], "the dataset is small and a single validation split would be noisy", ["uses the same fold for validation every time"], ["stratified k-fold"]),
  c("evalc", "stratified k-fold", 3, ["keeps the class proportions the same in every fold", "is the default splitter for classifiers in cross_val_score"], "classes are imbalanced and some folds might miss the rare class", undefined, ["k-fold cross-validation"]),
  c("evalc", "a learning curve", 3, ["plots training and validation score against training set size", "shows whether more data would help", "reveals a gap between the two scores when a model overfits"], "decide whether collecting more data is worthwhile"),
  c("evalc", "a baseline model", 2, ["is a trivial reference such as always predicting the majority class", "sets the minimum score a real model must beat"], "need to know whether 90 percent accuracy is actually impressive", undefined, ["DummyClassifier"]),
  c("evalc", "nested cross-validation", 5, ["wraps hyperparameter search inside an outer evaluation loop", "gives a less optimistic estimate than reusing the tuning folds"], "need an honest score for a pipeline that also tunes its own hyperparameters"),

  // ---- metrics
  c("metric", "accuracy", 1, ["is the fraction of predictions that are correct", "can look high on imbalanced data even for a useless model"], undefined, ["is the best metric for rare-event detection"]),
  c("metric", "precision", 2, ["is true positives divided by all predicted positives", "falls when there are many false positives"], "false alarms are expensive, such as flagging legitimate email as spam", ["is true positives divided by all actual positives"], ["recall"]),
  c("metric", "recall", 2, ["is true positives divided by all actual positives", "falls when real positives are missed", "is also called sensitivity"], "missing a real case is costly, such as a disease screening", ["counts false positives in its denominator"], ["precision"]),
  c("metric", "the F1 score", 2, ["is the harmonic mean of precision and recall", "is low if either precision or recall is low"], "need one number balancing precision and recall", undefined, ["precision", "recall"]),
  c("metric", "ROC-AUC", 3, ["is the area under the curve of true positive rate against false positive rate", "equals the probability a random positive is scored above a random negative", "is 0.5 for a model that ranks at random"], "compare how well models rank positives above negatives across all thresholds", ["needs hard class labels rather than scores"], ["PR-AUC"]),
  c("metric", "PR-AUC", 4, ["summarises the precision-recall curve", "is more informative than ROC-AUC when positives are very rare"], "the positive class is rare and ROC curves look overly good", undefined, ["ROC-AUC"]),
  c("metric", "RMSE", 2, ["is the square root of the mean squared error", "has the same units as the target", "penalises large errors more than MAE does"], "want an error in the target's units that punishes big misses", undefined, ["MAE"]),
  c("metric", "MAE", 2, ["is the mean of absolute errors", "is less sensitive to outliers than RMSE"], undefined, ["squares the errors before averaging"], ["RMSE"]),
  c("metric", "R-squared", 3, ["measures the share of target variance explained by the model", "can be negative on new data when a model is worse than predicting the mean"], undefined, ["can never be below zero"]),
  c("metric", "the confusion matrix", 2, ["counts true positives, false positives, false negatives and true negatives", "is the source for precision and recall"], "see exactly which classes are mistaken for which"),
  c("metric", "log loss", 4, ["penalises confident wrong probabilities heavily", "needs predicted probabilities rather than labels"], "want to judge the quality of predicted probabilities, not just labels", undefined, ["accuracy"]),
  c("metric", "specificity", 4, ["is true negatives divided by all actual negatives", "is the true negative rate"], undefined, undefined, ["recall"]),

  // ---- algorithms
  c("algo", "linear regression", 1, ["fits a weighted sum of features to a numeric target", "is commonly fitted by minimising squared error", "has coefficients that can be read as feature effects"], "want a simple, interpretable model of a numeric target", ["outputs class probabilities between 0 and 1"], ["logistic regression"]),
  c("algo", "logistic regression", 1, ["applies the sigmoid to a linear score to give a probability", "is a classification model despite its name", "is trained by minimising log loss"], "need a fast, interpretable baseline classifier with probabilities", ["is used to predict continuous values"], ["linear regression"]),
  c("algo", "a decision tree", 2, ["splits data by feature thresholds into regions", "can be drawn and read as if-then rules", "needs no feature scaling"], "want a model whose decisions can be explained as rules", ["is hurt by features on very different scales"], ["a random forest"]),
  c("algo", "a random forest", 2, ["averages many decision trees trained on bootstrap samples", "also chooses a random subset of features at each split", "usually overfits less than a single deep tree"], "want a strong default for tabular data with little tuning", ["builds its trees one after another, each fixing the last"], ["gradient boosting"]),
  c("algo", "gradient boosting", 3, ["builds trees one after another, each correcting the previous errors", "fits each new tree to the gradient of the loss", "has learning_rate and n_estimators that interact"], "want high accuracy on tabular data and can tune carefully", ["trains all trees independently in parallel on bootstrap samples"], ["a random forest"]),
  c("algo", "a support vector machine", 3, ["finds the boundary with the largest margin between classes", "uses kernels to learn non-linear boundaries", "depends on feature scaling"], "have a medium-sized dataset and want a maximum-margin classifier", ["works best without feature scaling"], ["k-nearest neighbours"]),
  c("algo", "k-nearest neighbours", 2, ["predicts from the labels of the k closest training examples", "does almost no work at fit time", "is sensitive to feature scaling and to irrelevant features"], "want a simple instance-based method with no training phase", ["learns a compact set of weights during fit"], ["a support vector machine"]),
  c("algo", "naive Bayes", 3, ["applies Bayes' rule assuming features are independent given the class", "trains very quickly even on many features", "is a common baseline for text classification"], "need a very fast baseline for word-count features"),
  c("algo", "AdaBoost", 4, ["increases the weight of misclassified examples after each round", "combines weak learners into a weighted vote"], undefined, undefined, ["gradient boosting"]),
  c("algo", "a multilayer perceptron", 3, ["stacks layers of weighted sums and non-linear activations", "is trained by backpropagation", "is available as MLPClassifier and MLPRegressor"], "want a small neural network inside scikit-learn", undefined, ["logistic regression"]),
  c("algo", "an extra-trees model", 5, ["picks split thresholds at random instead of searching for the best one", "usually trains faster than a random forest of the same size"], undefined, undefined, ["a random forest"]),
  c("algo", "SGDClassifier", 4, ["trains linear models by stochastic gradient descent", "supports partial_fit for out-of-core learning"], "data does not fit in memory and must be learned in chunks"),

  // ---- unsupervised algorithms
  c("unsup", "k-means", 1, ["assigns points to the nearest of k centroids", "alternates between assigning points and updating centroids", "needs the number of clusters chosen in advance"], "know roughly how many round clusters exist", ["finds clusters of arbitrary shape and flags noise points"], ["DBSCAN"]),
  c("unsup", "DBSCAN", 3, ["groups points by density and marks sparse ones as noise", "does not need the number of clusters in advance", "has eps and min_samples parameters"], "clusters have irregular shapes and there are outliers", ["requires the number of clusters up front"], ["k-means"]),
  c("unsup", "agglomerative clustering", 3, ["merges the closest clusters step by step", "builds a hierarchy that can be shown as a dendrogram"], "want a cluster hierarchy rather than a flat partition"),
  c("unsup", "a Gaussian mixture model", 4, ["models data as a mixture of Gaussian distributions", "gives soft cluster membership probabilities", "is fitted by the expectation-maximisation algorithm"], "want probabilities of belonging to each cluster", undefined, ["k-means"]),
  c("unsup", "PCA", 2, ["projects data onto orthogonal directions of maximum variance", "gives components ordered by explained variance", "is affected by feature scale"], "want fewer uncorrelated features that keep most of the variance", ["needs target labels to find its directions"], ["t-SNE"]),
  c("unsup", "t-SNE", 4, ["embeds high-dimensional data in two or three dimensions for plotting", "preserves local neighbourhoods more than global distances", "has no transform method for new data"], "visualise clusters in a high-dimensional dataset", undefined, ["PCA"]),
  c("unsup", "Isolation Forest", 4, ["isolates points with random splits to find anomalies", "scores outliers by how few splits they need to separate"], "detect outliers in tabular data without labels"),

  // ---- regularisation
  c("regm", "Ridge regression", 2, ["adds an L2 penalty on the squared coefficients", "shrinks coefficients toward zero but rarely makes them exactly zero", "has a penalty strength set by alpha"], "features are correlated and coefficients are unstable", ["sets many coefficients exactly to zero"], ["Lasso"]),
  c("regm", "Lasso", 2, ["adds an L1 penalty on the absolute coefficients", "can set coefficients exactly to zero", "acts as built-in feature selection"], "suspect only a few features matter and want a sparse model", ["only shrinks coefficients without ever zeroing them"], ["Ridge regression"]),
  c("regm", "elastic net", 3, ["mixes L1 and L2 penalties", "has an l1_ratio parameter that sets the mix"], "have many correlated features and still want sparsity", undefined, ["Lasso", "Ridge regression"]),
  c("regm", "the C parameter", 3, ["is the inverse of regularisation strength in LogisticRegression and SVC", "gives stronger regularisation as it gets smaller"], "need to tune how strongly a logistic regression is penalised", ["gives stronger regularisation as it gets larger"]),
  c("regm", "max_depth", 2, ["limits how deep a decision tree can grow", "reduces overfitting when lowered"], "a tree memorises the training data", undefined, ["tree pruning"]),
  c("regm", "tree pruning", 4, ["removes branches that add little predictive value", "is controlled in scikit-learn by ccp_alpha"], undefined, undefined, ["max_depth"]),
  c("regm", "early stopping", 3, ["halts training when validation score stops improving", "is an option in gradient boosting and MLP models"], "boosting keeps adding trees but validation score has stopped improving"),

  // ---- pitfalls
  c("pit", "data leakage", 2, ["lets information from outside the training data influence the model", "makes validation scores look better than real performance", "includes fitting a scaler on all data before splitting"], "a model scores near-perfect in testing but fails in production", ["improves honest generalisation"], ["target leakage"]),
  c("pit", "target leakage", 3, ["uses a feature that would not be known at prediction time", "often hides in columns recorded after the outcome"], "a feature turns out to be derived from the label itself", undefined, ["data leakage"]),
  c("pit", "class imbalance", 2, ["means one class is far rarer than the others", "makes accuracy misleading", "is handled with weights, resampling or threshold tuning"], "only one percent of examples are positive"),
  c("pit", "the curse of dimensionality", 3, ["makes data sparse as the number of features grows", "weakens distance-based methods such as k-NN"], "k-NN gets worse after adding hundreds of features"),
  c("pit", "concept drift", 4, ["happens when the relationship between inputs and target changes over time", "degrades a deployed model that is never retrained"], "a model that worked at launch slowly gets worse in production"),
  c("pit", "multicollinearity", 3, ["means features are strongly correlated with one another", "makes linear coefficients unstable"], "coefficients flip sign when one correlated feature is dropped"),
  c("pit", "label noise", 4, ["means some training labels are wrong", "limits the best achievable score and can be memorised by flexible models"], undefined),
  c("pit", "tuning on the test set", 3, ["makes the test score an optimistic estimate", "turns the test set into a second validation set"], "a team retrained many times until the test score went up"),

  // ---- imbalance remedies
  c("fix", "class_weight='balanced'", 3, ["gives rarer classes proportionally larger weights in the loss", "needs no change to the data itself"], "want to counter imbalance without resampling", undefined, ["oversampling"]),
  c("fix", "oversampling", 3, ["duplicates or synthesises minority examples", "should be applied only to the training folds"], undefined, ["is safe to apply before splitting the data"], ["SMOTE"]),
  c("fix", "undersampling", 3, ["removes majority-class examples", "discards data, which may lose useful information"], undefined, undefined, ["oversampling"]),
  c("fix", "SMOTE", 4, ["creates synthetic minority points by interpolating between neighbours", "is provided by the imbalanced-learn library"], undefined, undefined, ["oversampling"]),
  c("fix", "threshold moving", 4, ["changes the probability cut-off used to assign the positive class", "trades precision against recall without retraining"], "have good probabilities but need higher recall"),
  c("fix", "a stratified split", 2, ["preserves class proportions in each split", "is requested with the stratify argument of train_test_split"], "rare positives could disappear from the test set"),

  // ---- transformers
  c("tf", "StandardScaler", 1, ["rescales each feature to zero mean and unit variance", "learns means and standard deviations in fit"], "features have very different scales and the model is scale-sensitive", ["squeezes values into the 0 to 1 range"], ["MinMaxScaler", "RobustScaler"]),
  c("tf", "MinMaxScaler", 1, ["rescales each feature into a fixed range, 0 to 1 by default", "is sensitive to extreme outliers"], "need features bounded between 0 and 1", undefined, ["StandardScaler"]),
  c("tf", "RobustScaler", 3, ["scales using the median and interquartile range", "is far less affected by outliers than StandardScaler"], "features contain large outliers", undefined, ["StandardScaler"]),
  c("tf", "OneHotEncoder", 1, ["turns each category into its own 0 or 1 column", "has handle_unknown='ignore' for unseen categories", "returns a sparse matrix by default"], "have an unordered category such as city or colour", ["maps each category to an integer"], ["OrdinalEncoder"]),
  c("tf", "OrdinalEncoder", 2, ["maps each category to an integer code", "fits features, not the target column"], "categories have a natural order such as small, medium, large", undefined, ["OneHotEncoder", "LabelEncoder"]),
  c("tf", "LabelEncoder", 3, ["encodes target labels as integers 0 to n_classes-1", "is meant for the target y, not for feature columns"], undefined, undefined, ["OrdinalEncoder"]),
  c("tf", "SimpleImputer", 2, ["fills missing values with the mean, median, most frequent value or a constant", "learns the fill values from the training data"], "a column has NaN values that the model cannot handle", undefined, ["KNNImputer"]),
  c("tf", "KNNImputer", 4, ["fills a missing value from the nearest similar rows", "uses a distance that ignores missing coordinates"], undefined, undefined, ["SimpleImputer"]),
  c("tf", "PolynomialFeatures", 3, ["adds powers and interaction terms of the input features", "lets a linear model fit curved relationships"], "want a linear regression to fit a quadratic curve"),
  c("tf", "KBinsDiscretizer", 4, ["splits a continuous feature into bins", "can output one-hot encoded bins"], undefined),
  c("tf", "FunctionTransformer", 4, ["wraps any plain function as a pipeline step", "is often used for log transforms"], "apply a log transform inside a pipeline"),
  c("tf", "SelectKBest", 3, ["keeps the k features with the highest score from a statistical test", "needs a score function such as f_classif"], "keep only the 20 most informative features"),
  c("tf", "Normalizer", 4, ["scales each row to unit norm", "works on samples, not on columns"], undefined, ["scales each column to zero mean"], ["StandardScaler"]),

  // ---- API
  c("api", "the fit method", 1, ["learns parameters from training data", "returns the estimator itself", "stores learned values in attributes ending with an underscore"], "train an estimator on data", ["makes predictions on new data"], ["the predict method"]),
  c("api", "the predict method", 1, ["returns predicted labels or values for new samples", "needs a fitted estimator"], "produce class labels for new rows", undefined, ["the predict_proba method"]),
  c("api", "the predict_proba method", 2, ["returns class probabilities, one column per class", "gives rows that sum to 1 for classifiers that support it"], "need confidence scores rather than hard labels", undefined, ["the predict method"]),
  c("api", "the transform method", 2, ["applies a learned transformation to data", "uses statistics learned earlier in fit"], "scale test data with the training data's statistics", undefined, ["the fit_transform method"]),
  c("api", "the fit_transform method", 2, ["fits a transformer and transforms the same data in one call", "belongs on training data only"], "scale the training data", ["should also be called on the test set"], ["the transform method"]),
  c("api", "the score method", 2, ["returns a default metric, accuracy for classifiers and R-squared for regressors"], undefined, undefined, ["cross_val_score"]),
  c("api", "Pipeline", 2, ["chains transformers and a final estimator into one object", "applies fit and transform steps in order", "prevents leakage by refitting steps inside each cross-validation fold"], "want preprocessing and the model to be fitted and validated together", ["only works with a single step"], ["ColumnTransformer"]),
  c("api", "make_pipeline", 3, ["builds a Pipeline and names steps from lowercase class names", "needs no explicit step names"], undefined, undefined, ["Pipeline"]),
  c("api", "ColumnTransformer", 3, ["applies different transformers to different columns", "drops unlisted columns by default", "concatenates the results into one feature matrix"], "scale numeric columns and one-hot encode categorical ones", undefined, ["Pipeline"]),
  c("api", "the train_test_split function", 1, ["splits arrays into train and test subsets", "shuffles the rows by default", "accepts random_state for reproducibility"], "hold out part of the data for final evaluation"),
  c("api", "cross_val_score", 2, ["returns an array with one score per fold", "fits a fresh clone of the estimator for each fold"], "get k validation scores quickly", undefined, ["the score method"]),
  c("api", "get_params and set_params", 4, ["read and change hyperparameters on an estimator", "use double-underscore names to reach nested pipeline steps"], "change the C of a step inside a Pipeline"),
  c("api", "clone", 4, ["makes a new unfitted estimator with the same hyperparameters", "does not copy learned attributes"], undefined),
  c("api", "joblib.dump", 3, ["saves a fitted estimator or pipeline to disk", "is the usual way to persist scikit-learn models"], "need to save the trained pipeline for later use"),
  c("api", "classification_report", 3, ["prints precision, recall, F1 and support for each class"], "want per-class metrics in one text table"),

  // ---- hyperparameter search
  c("search", "GridSearchCV", 2, ["tries every combination in a parameter grid", "scores each combination with cross-validation", "refits the best model on all training data by default"], "have a small grid of hyperparameter values", ["samples random combinations from distributions"], ["RandomizedSearchCV"]),
  c("search", "RandomizedSearchCV", 3, ["samples a fixed number of combinations at random", "accepts distributions for continuous parameters", "controls cost through n_iter"], "the search space is large or continuous", ["tries every combination exhaustively"], ["GridSearchCV"]),
  c("search", "best_params_", 2, ["holds the best hyperparameters found by a search", "exists only after the search has been fitted"], "need the winning settings after a grid search"),
  c("search", "best_estimator_", 3, ["holds the model refitted with the best parameters", "exists only when refit is enabled"], "want to predict with the winning model directly"),
  c("search", "cv_results_", 4, ["holds mean and standard deviation of scores for every candidate", "can be loaded into a DataFrame for inspection"], "compare how close the top candidates were"),
  c("search", "the scoring argument", 3, ["chooses the metric a search optimises, such as f1 or roc_auc", "defaults to the estimator's own score"], "optimise F1 instead of accuracy"),
  c("search", "a hyperparameter", 1, ["is a setting chosen before training", "is not learned from the data by fit", "is tuned with validation data"], undefined, ["is learned by the model during fit"], ["a model parameter"]),
  c("search", "a model parameter", 2, ["is a value learned from data during fit", "includes coefficients and tree split thresholds"], undefined, ["is set by the practitioner before training"], ["a hyperparameter"]),

  // ---- ensembles
  c("ens", "bagging", 3, ["trains models on bootstrap samples and averages them", "mainly reduces variance"], "a single flexible model is unstable and overfits", ["mainly reduces bias by training models sequentially"], ["boosting"]),
  c("ens", "boosting", 3, ["trains models sequentially so each focuses on earlier errors", "mainly reduces bias"], "a simple model underfits and needs sequential refinement", ["trains models independently on bootstrap samples"], ["bagging"]),
  c("ens", "stacking", 4, ["feeds predictions of base models into a final meta-model", "uses cross-validated predictions to train the meta-model"], undefined, undefined, ["voting"]),
  c("ens", "a voting classifier", 3, ["combines several different models by majority vote or averaged probabilities", "has hard and soft voting modes"], "combine a logistic regression, a tree and an SVM", undefined, ["stacking"]),
  c("ens", "out-of-bag score", 4, ["is a validation estimate from samples left out of each bootstrap", "is enabled with oob_score=True in a random forest"], "want a validation estimate without a separate split"),
  c("ens", "HistGradientBoosting", 4, ["bins feature values into histograms to train gradient boosting quickly", "handles missing values natively"], "gradient boosting is too slow on a large dataset"),
  c("ens", "feature_importances_", 3, ["is an attribute of fitted tree ensembles", "shows each feature's relative contribution to splits", "sums to 1 for a random forest"], "ask which features a forest relied on", ["measures causal effect of a feature"]),

  // ---- training mechanics
  c("mech", "gradient descent", 2, ["repeatedly moves parameters against the gradient of the loss", "stops being useful when the step size is badly chosen"], "minimise a differentiable loss iteratively"),
  c("mech", "the learning rate", 2, ["sets the size of each parameter update", "causes divergence if too large", "makes training slow if too small"], "loss oscillates or explodes during training"),
  c("mech", "stochastic gradient descent", 3, ["updates parameters from a single sample or small batch", "uses noisy but cheap gradient estimates"], "dataset is large and full-batch updates are too slow"),
  c("mech", "a loss function", 1, ["measures how wrong predictions are", "is what training minimises"], undefined, ["is the same thing as an evaluation metric reported to users"]),
  c("mech", "the kernel trick", 4, ["computes inner products in a higher-dimensional space without building it", "lets an SVM learn non-linear boundaries"], "data is not linearly separable but a linear method is wanted"),
  c("mech", "Gini impurity", 3, ["measures how mixed the classes are at a tree node", "is the default split criterion for DecisionTreeClassifier"], undefined, undefined, ["entropy"]),
  c("mech", "entropy", 4, ["measures the uncertainty of class labels at a node", "is an alternative split criterion to Gini impurity"], undefined, undefined, ["Gini impurity"]),
  c("mech", "the normal equation", 5, ["solves linear regression in closed form", "becomes costly as the number of features grows"], "want the exact least-squares solution without iterating"),
  c("mech", "Euclidean distance", 2, ["is the straight-line distance between two points", "is the default metric in k-NN and k-means"], "need a notion of closeness in numeric feature space"),

  // ---- feature engineering
  c("fe", "feature scaling", 1, ["puts features on comparable ranges", "matters for k-NN, SVM, k-means and regularised models", "is unnecessary for tree-based models"], "distance or gradient methods are dominated by one large feature"),
  c("fe", "feature selection", 3, ["keeps only the most useful features", "can lower variance and speed up training"], "have many noisy features"),
  c("fe", "imputation", 2, ["fills in missing values", "should learn its fill values from the training data only"], "a column contains missing entries"),
  c("fe", "one-hot encoding", 2, ["represents each category as a separate indicator column", "avoids implying a false order between categories"], "city names should not be ranked"),
  c("fe", "permutation importance", 4, ["shuffles one feature and measures the drop in score", "works with any fitted model", "is computed on held-out data to avoid misleading results"], "need a model-agnostic importance measure", undefined, ["feature_importances_"]),
  c("fe", "target encoding", 5, ["replaces a category with a statistic of the target for that category", "must be computed within folds to avoid leakage"], "a categorical column has thousands of distinct values", undefined, ["one-hot encoding"]),
  c("fe", "a log transform", 3, ["compresses a long right tail", "helps with skewed positive features such as income"], "a feature spans several orders of magnitude"),
];

const qa: QA[] = [
  q(1, "How many rows end up in X_train?", "80", ["20", "100", "75"], "test_size=0.2 reserves 20 of 100 rows for testing, leaving 80.", `from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
# X has 100 rows
print(len(X_train))`, "Splitting"),
  q(2, "What is wrong with this workflow?", "The scaler saw the test data, which leaks information", ["Nothing, this is the recommended pattern", "StandardScaler cannot be used before splitting", "fit_transform returns the wrong shape"], "Scaling statistics must come from the training data only.", `X_scaled = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2)`, "Leakage"),
  q(2, "Which version avoids leakage?", "scaler.fit_transform(X_train) then scaler.transform(X_test)", ["scaler.fit_transform(X_train) then scaler.fit_transform(X_test)", "scaler.fit(X_test) then scaler.transform(X_train)", "scaler.transform(X_train) then scaler.fit(X_test)"], "Fit on train, then only transform test with the same statistics.", `scaler = StandardScaler()`, "Leakage"),
  q(3, "What happens to the scaler inside cross_val_score?", "It is refitted on the training portion of each fold", ["It is fitted once on all the data", "It is not fitted at all", "It is fitted on the validation fold"], "A Pipeline refits every step inside each fold, so no information leaks.", `pipe = make_pipeline(StandardScaler(), LogisticRegression())
scores = cross_val_score(pipe, X, y, cv=5)`, "Pipelines"),
  q(3, "What key refers to the SVC's C in a grid for this pipeline?", "svc__C", ["C", "svc.C", "pipe__C"], "make_pipeline names steps in lowercase and nested parameters use double underscores.", `pipe = make_pipeline(StandardScaler(), SVC())
param_grid = {...: [0.1, 1, 10]}`, "Pipelines"),
  q(3, "How many model fits does the search do during cross-validation, excluding the final refit?", "30", ["6", "5", "15"], "6 combinations times 5 folds is 30 fits.", `grid = GridSearchCV(SVC(), {"C": [0.1, 1, 10], "kernel": ["linear", "rbf"]}, cv=5)
grid.fit(X, y)`, "Search"),
  q(3, "How many cross-validation fits does this search run?", "100", ["20", "5", "25"], "20 sampled candidates times 5 folds gives 100 fits.", `search = RandomizedSearchCV(model, param_dist, n_iter=20, cv=5)
search.fit(X, y)`, "Search"),
  q(3, "What is grid.best_estimator_ after fitting with the default settings?", "The best candidate refitted on the whole training data", ["The worst candidate", "An unfitted copy of the original estimator", "A list of all fitted candidates"], "refit=True retrains the best parameters on all the data passed to fit.", `grid = GridSearchCV(model, params, cv=5)
grid.fit(X_train, y_train)
best = grid.best_estimator_`, "Search"),
  q(2, "What does cross_val_score return?", "An array of 5 scores, one per fold", ["A single averaged score", "A fitted model", "A confusion matrix"], "Average it yourself with scores.mean().", `scores = cross_val_score(model, X, y, cv=5)`, "Validation"),
  q(2, "What is the recall?", "0.5", ["0.67", "0.4", "0.75"], "TP = 2 and FN = 2 so recall is 2 / 4 = 0.5.", `from sklearn.metrics import recall_score
y_true = [1, 0, 1, 1, 1]
y_pred = [1, 1, 1, 0, 0]
print(recall_score(y_true, y_pred))`, "Metrics"),
  q(2, "What is the precision?", "0.67", ["0.5", "0.4", "1.0"], "TP = 2 and FP = 1 so precision is 2 / 3.", `from sklearn.metrics import precision_score
y_true = [1, 0, 1, 1, 1]
y_pred = [1, 1, 1, 0, 0]
print(precision_score(y_true, y_pred))`, "Metrics"),
  q(3, "With TP = 40, FP = 10, FN = 20 and TN = 30, what is the recall?", "0.67", ["0.80", "0.50", "0.57"], "Recall = 40 / (40 + 20).", undefined, "Metrics"),
  q(3, "With TP = 40, FP = 10, FN = 20 and TN = 30, what is the accuracy?", "0.70", ["0.80", "0.67", "0.60"], "Correct = 40 + 30 = 70 out of 100.", undefined, "Metrics"),
  q(3, "What is the F1 score for precision 0.8 and recall 0.5?", "About 0.62", ["0.65", "0.40", "0.80"], "F1 = 2PR / (P + R) = 0.8 / 1.3.", undefined, "Metrics"),
  q(2, "What is the shape of the output?", "(10, 3), each row summing to 1", ["(10,), class labels", "(3, 10), each column summing to 1", "(10, 1), the winning probabilities"], "predict_proba returns one probability per class for every sample.", `# a 3-class classifier fitted earlier, X_new has 10 rows
proba = clf.predict_proba(X_new)
print(proba.shape)`, "API"),
  q(3, "What does a smaller C do in LogisticRegression?", "Applies stronger regularisation", ["Applies weaker regularisation", "Increases the number of iterations", "Switches the penalty to L1"], "C is the inverse of the regularisation strength.", `LogisticRegression(C=0.01)`, "Regularisation"),
  q(3, "What is the effect of a very large alpha on a Lasso model?", "Most or all coefficients shrink to exactly zero", ["All coefficients grow without limit", "Coefficients become equal to each other", "The model switches to a classifier"], "A large L1 penalty zeroes coefficients.", `model = Lasso(alpha=1000).fit(X, y)
print(model.coef_)`, "Regularisation"),
  q(2, "What does this print, to two decimals?", "[-1.22  0.    1.22]", ["[0.  0.5  1. ]", "[-1.  0.  1.]", "[1. 2. 3.]"], "StandardScaler subtracts the mean 2 and divides by the standard deviation about 0.8165.", `import numpy as np
from sklearn.preprocessing import StandardScaler
x = np.array([[1.0], [2.0], [3.0]])
print(StandardScaler().fit_transform(x).ravel().round(2))`, "Preprocessing"),
  q(2, "What does this print?", "[0.  0.5 1. ]", ["[-1.  0.  1.]", "[0.1 0.2 0.3]", "[10. 20. 30.]"], "MinMaxScaler maps the minimum to 0 and the maximum to 1.", `x = np.array([[10.0], [20.0], [30.0]])
print(MinMaxScaler().fit_transform(x).ravel())`, "Preprocessing"),
  q(2, "What is the shape of the result?", "(3, 2)", ["(3, 3)", "(3, 1)", "(2, 3)"], "Two distinct categories give two indicator columns for three rows.", `enc = OneHotEncoder(sparse_output=False)
out = enc.fit_transform([["red"], ["green"], ["red"]])
print(out.shape)`, "Preprocessing"),
  q(3, "Which setting stops OneHotEncoder raising an error for a category not seen in training?", "handle_unknown='ignore'", ["drop='all'", "sparse_output=True", "categories='auto'"], "Unknown categories then become all-zero rows.", `OneHotEncoder(...)`, "Preprocessing"),
  q(3, "What does ColumnTransformer do with a column not listed in any transformer?", "Drops it, because remainder defaults to 'drop'", ["Passes it through unchanged", "Raises an error", "Scales it automatically"], "Set remainder='passthrough' to keep unlisted columns.", `ct = ColumnTransformer([
    ("num", StandardScaler(), ["age", "income"]),
    ("cat", OneHotEncoder(), ["city"]),
])`, "Pipelines"),
  q(2, "Which value replaces the NaN?", "2.0", ["34.3", "1.0", "100.0"], "The median of 1, 2 and 100 is 2.", `imp = SimpleImputer(strategy="median")
print(imp.fit_transform([[1], [2], [100], [np.nan]]).ravel())`, "Preprocessing"),
  q(2, "Which attribute holds the learned centroids?", "cluster_centers_", ["labels_", "inertia_", "centroids"], "labels_ holds the assignments and inertia_ the within-cluster sum of squares.", `km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(X)`, "Clustering"),
  q(3, "Why scale features before k-means?", "Distances are dominated by features with large numeric ranges", ["k-means requires all values to be integers", "Scaling chooses the number of clusters", "Unscaled data makes inertia negative"], "k-means uses Euclidean distance, so scale matters.", undefined, "Clustering"),
  q(2, "What shape does X_2d have?", "(100, 2)", ["(2, 10)", "(10, 2)", "(100, 10)"], "PCA keeps 2 components for each of the 100 rows.", `pca = PCA(n_components=2)
X_2d = pca.fit_transform(X)   # X has shape (100, 10)`, "Dimensionality"),
  q(3, "What does n_components=0.95 mean?", "Keep the fewest components that explain 95 percent of the variance", ["Keep 95 percent of the features at random", "Keep 0.95 components", "Drop components with variance above 0.95"], "A float between 0 and 1 is a variance target.", `PCA(n_components=0.95)`, "Dimensionality"),
  q(3, "What is the usual effect of setting max_depth=3?", "Less overfitting and a simpler, more interpretable tree", ["Higher variance", "Guaranteed better test accuracy", "The tree needs scaled features"], "Shallow trees are less able to memorise noise.", `DecisionTreeClassifier(max_depth=3)`, "Trees"),
  q(3, "What do the importances add up to?", "1.0", ["The number of trees", "The number of features", "The out-of-bag score"], "feature_importances_ is normalised to sum to 1.", `rf = RandomForestClassifier(n_estimators=200).fit(X, y)
print(rf.feature_importances_.sum())`, "Trees"),
  q(3, "What is the training accuracy likely to be, assuming no duplicate points with conflicting labels?", "About 1.0, because each point is its own nearest neighbour", ["About 0.5", "Exactly the same as test accuracy", "It cannot be computed"], "k=1 memorises the training set.", `knn = KNeighborsClassifier(n_neighbors=1).fit(X_train, y_train)
print(knn.score(X_train, y_train))`, "Algorithms"),
  q(3, "Why use StratifiedKFold here?", "To keep the class proportions the same in every fold", ["To make training faster", "To remove duplicates", "To scale features in each fold"], "With rare classes, random folds can miss a class.", `cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)`, "Validation"),
  q(4, "Why is KFold with shuffling a poor choice for forecasting?", "It lets the model train on the future and validate on the past", ["It cannot produce 5 folds", "It ignores the target", "It always overfits"], "Use TimeSeriesSplit so validation always follows training in time.", `from sklearn.model_selection import TimeSeriesSplit
cv = TimeSeriesSplit(n_splits=5)`, "Validation"),
  q(3, "What does class_weight='balanced' do?", "Weights classes inversely to their frequency", ["Duplicates the minority rows", "Drops majority rows", "Sets the decision threshold to 0.5"], "Rare classes get larger weights in the loss.", `LogisticRegression(class_weight="balanced")`, "Imbalance"),
  q(3, "What should the second argument of roc_auc_score be?", "Predicted probabilities or scores for the positive class", ["Predicted class labels", "The test features", "The confusion matrix"], "ROC-AUC needs a ranking score.", `from sklearn.metrics import roc_auc_score
roc_auc_score(y_test, ...)`, "Metrics"),
  q(3, "Which line produces it for a binary classifier?", "model.predict_proba(X_test)[:, 1]", ["model.predict(X_test)", "model.score(X_test, y_test)", "model.predict_proba(X_test).sum()"], "Column 1 holds the probability of the positive class.", `auc = roc_auc_score(y_test, ...)`, "Metrics"),
  q(2, "What accuracy does the baseline get when 95 percent of the labels are the majority class?", "About 0.95", ["About 0.50", "About 0.05", "Exactly 1.0"], "Always predicting the majority class is right 95 percent of the time.", `dummy = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)
print(dummy.score(X_test, y_test))`, "Metrics"),
  q(3, "Can R-squared be negative?", "Yes, when the model fits worse than always predicting the mean", ["No, it is always between 0 and 1", "Only for classification", "Only on training data"], "On held-out data, a poor model can score below zero.", `from sklearn.metrics import r2_score`, "Metrics"),
  q(2, "How do you compute RMSE from predictions?", "np.sqrt(mean_squared_error(y_true, y_pred))", ["mean_squared_error(y_true, y_pred) ** 2", "np.sqrt(accuracy_score(y_true, y_pred))", "np.abs(y_true - y_pred).mean()"], "RMSE is the square root of MSE.", undefined, "Metrics"),
  q(2, "What are coef_ and intercept_?", "coef_ is [2.] and intercept_ is 1.0", ["coef_ is [1.] and intercept_ is 2.0", "coef_ is [3.] and intercept_ is 0.0", "coef_ is [2.] and intercept_ is 0.0"], "The data follow y = 2x + 1 exactly.", `X = [[1], [2], [3]]
y = [3, 5, 7]
m = LinearRegression().fit(X, y)
print(m.coef_, m.intercept_)`, "Algorithms"),
  q(2, "What does a trailing underscore on an attribute like coef_ mean?", "It is set during fit, from the data", ["It is a private attribute", "It is a deprecated attribute", "It is set in the constructor"], "scikit-learn marks learned attributes this way.", undefined, "API"),
  q(2, "What happens when transform is called before fit?", "NotFittedError", ["It returns zeros", "It silently fits on the input", "It returns the input unchanged"], "Estimators must learn their parameters first.", `scaler = StandardScaler()
scaler.transform(X)`, "API"),
  q(4, "Why does this raise an error with the default settings?", "SVC does not compute probabilities unless probability=True", ["SVC cannot be used for classification", "predict_proba is only for regressors", "The data must be one-hot encoded"], "Probability estimates need extra internal cross-validation, so they are off by default.", `clf = SVC().fit(X_train, y_train)
clf.predict_proba(X_test)`, "Algorithms"),
  q(4, "What is the likely effect of a very large gamma in an RBF SVM?", "The model overfits with very tight, local decision regions", ["The model underfits with a nearly flat boundary", "Training becomes linear", "Probabilities are produced automatically"], "Large gamma makes each training point influence only its immediate neighbourhood.", `SVC(kernel="rbf", gamma=1000)`, "Algorithms"),
  q(4, "How does lowering learning_rate usually change the best n_estimators in gradient boosting?", "More trees are usually needed", ["Fewer trees are needed", "n_estimators no longer matters", "Trees must be deeper"], "Smaller steps need more rounds to reach the same fit.", `GradientBoostingClassifier(learning_rate=0.05, n_estimators=...)`, "Ensembles"),
  q(3, "Why save the whole pipeline instead of only the model?", "Prediction needs the same preprocessing that was fitted in training", ["Models cannot be pickled by themselves", "Pipelines are smaller", "joblib only accepts pipelines"], "The scaler and encoder statistics are part of the predictor.", `import joblib
joblib.dump(pipe, "model.joblib")
pipe2 = joblib.load("model.joblib")`, "API"),
  q(3, "What does the report contain for each class?", "Precision, recall, F1 and support", ["Only the accuracy", "Coefficients and intercepts", "The ROC curve points"], "classification_report summarises per-class metrics.", `from sklearn.metrics import classification_report
print(classification_report(y_test, y_pred))`, "Metrics"),
  q(4, "Which call changes the C of the SVC step in an existing pipeline?", "pipe.set_params(svc__C=10)", ["pipe.C = 10", "pipe.set_params(C=10)", "pipe.fit(C=10)"], "Nested parameters use step__param names.", `pipe = make_pipeline(StandardScaler(), SVC())`, "Pipelines"),
  q(2, "Training score is 0.99 and validation score is 0.72. What is the likely diagnosis?", "Overfitting (high variance)", ["Underfitting (high bias)", "Data is perfectly clean", "The metric is wrong"], "A large gap between training and validation scores signals high variance.", undefined, "Diagnosis"),
  q(2, "A model has 99 percent accuracy on data where 1 percent of cases are positive. What can you conclude?", "Nothing yet, since predicting all negatives also scores 99 percent", ["It is an excellent model", "It has perfect recall", "It has perfect precision"], "Accuracy hides failure on a rare class.", undefined, "Metrics"),
  q(3, "What does clone(model) return?", "A new unfitted estimator with the same hyperparameters", ["A fitted copy with the same coefficients", "A reference to the same object", "A pipeline wrapping the model"], "clone copies parameters, not learned state.", `from sklearn.base import clone
m2 = clone(model)`, "API"),
  q(3, "Which tool is meant for encoding the target y rather than feature columns?", "LabelEncoder", ["OneHotEncoder", "ColumnTransformer", "PolynomialFeatures"], "LabelEncoder maps class labels to integers.", undefined, "Preprocessing"),
  q(2, "What is the range of the silhouette score?", "-1 to 1", ["0 to 1", "0 to infinity", "-infinity to infinity"], "Higher values mean points sit well inside their own cluster.", `from sklearn.metrics import silhouette_score
score = silhouette_score(X, labels)`, "Clustering"),
  q(3, "Increasing the degree of PolynomialFeatures too far most likely does what?", "Raises variance and risks overfitting", ["Raises bias and underfits", "Lowers training score", "Removes the need for validation"], "Flexible models fit noise.", `make_pipeline(PolynomialFeatures(degree=15), LinearRegression())`, "Diagnosis"),
  q(4, "Why must the SMOTE step be inside the cross-validation training folds only?", "Synthetic points made before splitting leak copies of validation information into training", ["SMOTE needs unlabeled data", "SMOTE cannot be used with a Pipeline", "Validation data must be balanced"], "Resample only training data, never validation or test data.", undefined, "Imbalance"),
  q(5, "What does nested cross-validation add over GridSearchCV's best_score_?", "A less biased estimate, because tuning and evaluation use different splits", ["Faster training", "Automatic feature selection", "Higher accuracy on the training set"], "best_score_ is optimistic because it was selected using the same folds.", undefined, "Validation"),
  q(3, "Which setting makes a random forest report a built-in validation estimate?", "oob_score=True", ["warm_start=True", "bootstrap=False", "class_weight='oob'"], "Out-of-bag samples are used for scoring.", `RandomForestClassifier(oob_score=True).fit(X, y)`, "Ensembles"),
];

const spec: TrackSpec = {
  slug: "ml-sklearn-titan",
  name: "Machine Learning & scikit-learn: Novice to Titan",
  description: "Core machine-learning ideas and the scikit-learn API: learning paradigms, evaluation and validation, metrics, algorithms, regularisation, feature engineering, pipelines, leakage, class imbalance and hyperparameter search.",
  roles: "developer",
  groups: {
    task: "machine-learning task or paradigm",
    evalc: "model-evaluation concept",
    metric: "evaluation metric",
    algo: "supervised learning algorithm",
    unsup: "unsupervised learning algorithm",
    regm: "regularisation technique",
    pit: "common modelling pitfall",
    fix: "class-imbalance technique",
    tf: "scikit-learn preprocessing tool",
    api: "scikit-learn API element",
    search: "hyperparameter-tuning concept",
    ens: "ensemble concept",
    mech: "training-mechanics concept",
    fe: "feature-engineering concept",
  },
  cards,
  qa,
  calc: [],
};
export default spec;
